import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { getAuthPool } from './tenant-context';
import { hashPassword, verifyPassword } from './password';
import { signToken, verifyToken, type JwtPayload } from './jwt';
import type { RolUsuari } from './rbac';

/** Nom de la cookie httpOnly on viatja el JWT (docs/agents/AGENT_AUTH.md §3). */
export const AUTH_COOKIE_NAME = 'gestinmo_session';

// Regla no funcional docs/requirements.md §4: bloqueig temporal després d'intents
// fallits repetits. Valors fixos (no configurables per tenant, a diferència de
// `jwt_expiracio_minuts`): els requisits no en demanen configuració per agència.
const MAX_INTENTS_FALLITS = 5;
const BLOQUEIG_MINUTS = 15;

interface TenantUserRow {
  id: string;
  tenant_id: string;
  password_hash: string;
  rol: RolUsuari;
  actiu: boolean;
  intents_fallits: number;
  bloquejat_fins: Date | null;
  jwt_expiracio_minuts: number;
}

export interface LoginMeta {
  ipAddress?: string;
  userAgent?: string;
}

export type LoginResult =
  | { ok: true; token: string; payload: JwtPayload }
  | { ok: false; reason: 'invalid_credentials' }
  | { ok: false; reason: 'account_locked'; lockedUntil: Date };

// Calculat de forma perezosa un únic cop per procés: permet comparar contra un hash
// bcrypt vàlid quan l'usuari no existeix, per no filtrar per timing si un email està
// o no donat d'alta (docs/agents/AGENT_AUTH.md §8 — evitar enumeració d'usuaris).
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('valor-fixe-nomes-per-normalitzar-el-temps-de-resposta');
  }
  return dummyHashPromise;
}

/**
 * Login per email + contrasenya. El `tenant_id` no es coneix a priori (l'email és únic
 * només per tenant, `docs/db-schema.md` §3.2): es cerca l'usuari globalment a
 * `public.tenant_users` i el tenant es resol a partir del registre trobat.
 *
 * Retorna sempre el mateix `reason: 'invalid_credentials'` tant si l'usuari no existeix
 * com si la contrasenya és incorrecta (mai es distingeix externament, evita enumeració
 * d'usuaris); internament es registra quin dels dos ha estat.
 */
export async function login(email: string, plainPassword: string, meta: LoginMeta = {}): Promise<LoginResult> {
  const pool = getAuthPool();

  const { rows } = await pool.query<TenantUserRow>(
    `SELECT tu.id, tu.tenant_id, tu.password_hash, tu.rol, tu.actiu,
            tu.intents_fallits, tu.bloquejat_fins, t.jwt_expiracio_minuts
       FROM public.tenant_users tu
       JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.email = $1 AND tu.deleted_at IS NULL
      ORDER BY tu.created_at ASC
      LIMIT 1`,
    [email]
  );

  const user = rows[0];

  if (!user || !user.actiu) {
    await verifyPassword(plainPassword, await getDummyHash());
    console.warn('[auth] login rebutjat: usuari inexistent o desactivat', { email });
    return { ok: false, reason: 'invalid_credentials' };
  }

  if (user.bloquejat_fins && user.bloquejat_fins.getTime() > Date.now()) {
    return { ok: false, reason: 'account_locked', lockedUntil: user.bloquejat_fins };
  }

  const passwordValid = await verifyPassword(plainPassword, user.password_hash);
  if (!passwordValid) {
    await registrarIntentFallit(pool, user.id, user.intents_fallits);
    console.warn('[auth] login rebutjat: contrasenya incorrecta', { email });
    return { ok: false, reason: 'invalid_credentials' };
  }

  await pool.query(
    `UPDATE public.tenant_users
        SET intents_fallits = 0, bloquejat_fins = NULL, ultim_login = now()
      WHERE id = $1`,
    [user.id]
  );

  const { token } = await createSession(
    { id: user.id, tenantId: user.tenant_id, rol: user.rol },
    meta,
    user.jwt_expiracio_minuts
  );

  const payload = await verifyToken(token);
  if (!payload) {
    // No hauria de passar mai (el token s'acaba de signar aquí mateix).
    throw new Error('No s\'ha pogut verificar el token acabat de signar.');
  }

  return { ok: true, token, payload };
}

async function registrarIntentFallit(pool: Pool, tenantUserId: string, intentsActuals: number): Promise<void> {
  const seguentIntents = intentsActuals + 1;
  const calBloquejar = seguentIntents >= MAX_INTENTS_FALLITS;
  await pool.query(
    `UPDATE public.tenant_users
        SET intents_fallits = $2,
            bloquejat_fins = CASE WHEN $3 THEN now() + make_interval(mins => $4) ELSE bloquejat_fins END
      WHERE id = $1`,
    [tenantUserId, seguentIntents, calBloquejar, BLOQUEIG_MINUTS]
  );
}

interface CreateSessionUser {
  id: string;
  tenantId: string;
  rol: RolUsuari;
}

/** Insereix una nova sessió a `tenant_user_sessions` i retorna el JWT signat. */
export async function createSession(
  user: CreateSessionUser,
  meta: LoginMeta,
  jwtExpiracioMinuts: number
): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + jwtExpiracioMinuts * 60_000);

  await getAuthPool().query(
    `INSERT INTO public.tenant_user_sessions (tenant_user_id, token_jti, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, jti, meta.ipAddress ?? null, meta.userAgent ?? null, expiresAt]
  );

  const token = await signToken(
    { sub: user.id, tenant_id: user.tenantId, rol: user.rol, jti },
    jwtExpiracioMinuts
  );

  return { token, jti, expiresAt };
}

/** Marca una sessió com a revocada (ex: "tancar sessió" des d'una pantalla). */
export async function revokeSession(jti: string): Promise<void> {
  await getAuthPool().query(
    `UPDATE public.tenant_user_sessions SET revoked_at = now() WHERE token_jti = $1 AND revoked_at IS NULL`,
    [jti]
  );
}

/** Revoca totes les sessions d'un usuari (ex: "tancar sessió a tots els dispositius"). */
export async function revokeAllSessions(tenantUserId: string): Promise<void> {
  await getAuthPool().query(
    `UPDATE public.tenant_user_sessions SET revoked_at = now() WHERE tenant_user_id = $1 AND revoked_at IS NULL`,
    [tenantUserId]
  );
}

/**
 * Consulta si una sessió segueix activa a `tenant_user_sessions` (ni revocada ni
 * expirada). El middleware d'Edge Runtime confia en l'`exp` del JWT per a la majoria de
 * peticions; aquesta funció es reserva per a operacions sensibles que criden
 * explícitament l'API/Server Actions (docs/agents/AGENT_AUTH.md §3).
 */
export async function isSessionActive(jti: string): Promise<boolean> {
  const { rows } = await getAuthPool().query<{ active: boolean }>(
    `SELECT (revoked_at IS NULL AND expires_at > now()) AS active
       FROM public.tenant_user_sessions
      WHERE token_jti = $1`,
    [jti]
  );
  return rows[0]?.active ?? false;
}
