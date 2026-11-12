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
  canvi_contrasenya_obligatori: boolean;
  jwt_expiracio_minuts: number;
}

export interface LoginMeta {
  ipAddress?: string;
  userAgent?: string;
}

export type LoginResult =
  | { ok: true; token: string; payload: JwtPayload }
  | { ok: false; reason: 'invalid_credentials' }
  | { ok: false; reason: 'account_disabled' }
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
            tu.intents_fallits, tu.bloquejat_fins, tu.canvi_contrasenya_obligatori, t.jwt_expiracio_minuts
       FROM public.tenant_users tu
       JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.email = $1 AND tu.deleted_at IS NULL
      ORDER BY tu.created_at ASC
      LIMIT 1`,
    [email]
  );

  const user = rows[0];

  if (!user) {
    await verifyPassword(plainPassword, await getDummyHash());
    console.warn('[auth] login rebutjat: usuari inexistent', { email });
    return { ok: false, reason: 'invalid_credentials' };
  }

  // El missatge específic de docs/ux-flows.md §3.1 només es mostra amb la contrasenya
  // correcta: sense ella, un compte desactivat no es distingeix d'un d'inexistent.
  if (!user.actiu) {
    const valid = await verifyPassword(plainPassword, user.password_hash);
    console.warn('[auth] login rebutjat: usuari desactivat', { email });
    return { ok: false, reason: valid ? 'account_disabled' : 'invalid_credentials' };
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
    { id: user.id, tenantId: user.tenant_id, rol: user.rol, canviContrasenya: user.canvi_contrasenya_obligatori },
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
  canviContrasenya?: boolean;
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
    {
      sub: user.id,
      tenant_id: user.tenantId,
      rol: user.rol,
      jti,
      ...(user.canviContrasenya ? { canvi_contrasenya: true as const } : {}),
    },
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

export type CanviContrasenyaResult = 'ok' | 'contrasenya_incorrecta' | 'compte_bloquejat' | 'usuari_no_trobat';

/**
 * Canvi de contrasenya de l'usuari autenticat. Exigeix la contrasenya actual: una sessió
 * oberta en un ordinador aliè no ha de bastar per prendre el compte. Els errors compten
 * com a intents fallits del login, perquè no serveixi per endevinar-la a força d'intents.
 * Revoca la resta de sessions de l'usuari i conserva la que fa el canvi.
 */
export async function canviarContrasenya(
  tenantUserId: string,
  actual: string,
  nova: string,
  jtiActual: string
): Promise<CanviContrasenyaResult> {
  const pool = getAuthPool();
  const { rows } = await pool.query<Pick<TenantUserRow, 'password_hash' | 'intents_fallits' | 'bloquejat_fins'>>(
    `SELECT password_hash, intents_fallits, bloquejat_fins
       FROM public.tenant_users
      WHERE id = $1 AND actiu AND deleted_at IS NULL`,
    [tenantUserId]
  );

  const user = rows[0];
  if (!user) return 'usuari_no_trobat';
  if (user.bloquejat_fins && user.bloquejat_fins.getTime() > Date.now()) return 'compte_bloquejat';

  if (!(await verifyPassword(actual, user.password_hash))) {
    await registrarIntentFallit(pool, tenantUserId, user.intents_fallits);
    return 'contrasenya_incorrecta';
  }

  const nouHash = await hashPassword(nova);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE public.tenant_users
          SET password_hash = $2, intents_fallits = 0, bloquejat_fins = NULL, canvi_contrasenya_obligatori = false
        WHERE id = $1`,
      [tenantUserId, nouHash]
    );
    await client.query(
      `UPDATE public.tenant_user_sessions
          SET revoked_at = now()
        WHERE tenant_user_id = $1 AND token_jti <> $2 AND revoked_at IS NULL`,
      [tenantUserId, jtiActual]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return 'ok';
}

/**
 * Substitueix la sessió actual per una de nova amb l'estat vigent de l'usuari. Es fa servir
 * després del canvi obligatori de contrasenya: el JWT antic porta `canvi_contrasenya` i
 * el middleware el continuaria desviant a "El meu compte" fins que caduqués.
 */
export async function reemetreSessio(
  payload: JwtPayload,
  meta: LoginMeta
): Promise<{ token: string; expiresAt: Date }> {
  const { rows } = await getAuthPool().query<Pick<TenantUserRow, 'rol' | 'canvi_contrasenya_obligatori' | 'jwt_expiracio_minuts'>>(
    `SELECT tu.rol, tu.canvi_contrasenya_obligatori, t.jwt_expiracio_minuts
       FROM public.tenant_users tu
       JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.id = $1 AND tu.tenant_id = $2 AND tu.actiu AND tu.deleted_at IS NULL`,
    [payload.sub, payload.tenant_id]
  );
  const user = rows[0];
  if (!user) throw new Error("L'usuari de la sessió ja no existeix o està desactivat.");

  const nova = await createSession(
    { id: payload.sub, tenantId: payload.tenant_id, rol: user.rol, canviContrasenya: user.canvi_contrasenya_obligatori },
    meta,
    user.jwt_expiracio_minuts
  );
  await revokeSession(payload.jti);
  return { token: nova.token, expiresAt: nova.expiresAt };
}

/**
 * Allarga una sessió encara activa amb l'expiració vigent del tenant i en torna un JWT
 * nou amb el mateix `jti`. Rol i indicador de canvi de contrasenya es llegeixen de la BD,
 * de manera que un canvi de rol s'aplica a la renovació següent.
 *
 * Retorna `null` si la sessió s'ha revocat o ha caducat, o si l'usuari ja no està actiu:
 * qui crida ha de tancar la sessió.
 */
export async function renovarSessio(payload: JwtPayload): Promise<{ token: string; expiresAt: Date } | null> {
  const { rows } = await getAuthPool().query<{
    expires_at: Date;
    rol: RolUsuari;
    canvi_contrasenya_obligatori: boolean;
    jwt_expiracio_minuts: number;
  }>(
    `UPDATE public.tenant_user_sessions s
        SET expires_at = now() + make_interval(mins => t.jwt_expiracio_minuts)
       FROM public.tenant_users tu
       JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE s.token_jti = $1
        AND s.tenant_user_id = tu.id
        AND tu.id = $2
        AND tu.tenant_id = $3
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND tu.actiu
        AND tu.deleted_at IS NULL
      RETURNING s.expires_at, tu.rol, tu.canvi_contrasenya_obligatori, t.jwt_expiracio_minuts`,
    [payload.jti, payload.sub, payload.tenant_id]
  );

  const sessio = rows[0];
  if (!sessio) return null;

  const token = await signToken(
    {
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      rol: sessio.rol,
      jti: payload.jti,
      ...(sessio.canvi_contrasenya_obligatori ? { canvi_contrasenya: true as const } : {}),
    },
    sessio.jwt_expiracio_minuts
  );
  return { token, expiresAt: sessio.expires_at };
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
