// Configuració del tenant i usuaris interns (docs/requirements.md §3.1). Treballa sobre
// taules globals `public.*`: totes les queries filtren per `tenant_id` explícitament.

import type { RolUsuari } from '../auth/rbac';
import { BusinessRuleError } from './business-error';
import { getDomainPool } from './pool';
import type { ActualitzarTenant, CrearUsuari } from '../validations/configuracio';

export interface TenantConfig {
  nom: string;
  nif: string;
  adreca: string;
  jwtExpiracioMinuts: number;
}

export interface UsuariIntern {
  id: string;
  email: string;
  nom: string;
  rol: RolUsuari;
  actiu: boolean;
  ultimLogin: string | null;
}

export async function obtenirTenantConfig(tenantId: string): Promise<TenantConfig | null> {
  const { rows } = await getDomainPool().query<TenantConfig>(
    `SELECT nom, coalesce(configuracio->>'nif', '') AS nif, coalesce(configuracio->>'adreca', '') AS adreca,
            jwt_expiracio_minuts AS "jwtExpiracioMinuts"
       FROM public.tenants
      WHERE id = $1`,
    [tenantId]
  );
  return rows[0] ?? null;
}

export async function actualitzarTenantConfig(tenantId: string, input: ActualitzarTenant): Promise<void> {
  await getDomainPool().query(
    `UPDATE public.tenants
        SET nom = $2,
            jwt_expiracio_minuts = $3,
            configuracio = configuracio || jsonb_build_object('nif', $4::text, 'adreca', $5::text)
      WHERE id = $1`,
    [tenantId, input.nom, input.jwtExpiracioMinuts, input.nif ?? null, input.adreca ?? null]
  );
}

export async function llistarUsuaris(tenantId: string): Promise<UsuariIntern[]> {
  const { rows } = await getDomainPool().query<UsuariIntern>(
    `SELECT id, email, concat_ws(' ', nom, cognoms) AS nom, rol, actiu,
            to_char(ultim_login, 'DD/MM/YYYY HH24:MI') AS "ultimLogin"
       FROM public.tenant_users
      WHERE tenant_id = $1 AND deleted_at IS NULL
      ORDER BY nom, cognoms`,
    [tenantId]
  );
  return rows;
}

export async function crearUsuari(tenantId: string, input: CrearUsuari, passwordHash: string): Promise<void> {
  const pool = getDomainPool();

  // El login cerca per email a tots els tenants i es queda amb el més antic
  // (`src/lib/auth/session.ts`): un email repetit deixaria aquest compte inaccessible.
  const { rows } = await pool.query('SELECT 1 FROM public.tenant_users WHERE email = $1 LIMIT 1', [input.email]);
  if (rows.length > 0) {
    throw new BusinessRuleError('Aquest email ja està en ús.');
  }

  await pool.query(
    `INSERT INTO public.tenant_users (tenant_id, email, password_hash, nom, cognoms, rol)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, input.email, passwordHash, input.nom, input.cognoms ?? null, input.rol]
  );
}

/**
 * Restabliment per part d'un administrador: posa una contrasenya nova i desbloqueja el
 * compte. Revocar les sessions de l'usuari és responsabilitat de qui crida.
 */
export async function restablirContrasenyaUsuari(
  tenantId: string,
  usuariId: string,
  passwordHash: string
): Promise<boolean> {
  const { rowCount } = await getDomainPool().query(
    `UPDATE public.tenant_users
        SET password_hash = $3, intents_fallits = 0, bloquejat_fins = NULL
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [usuariId, tenantId, passwordHash]
  );
  return (rowCount ?? 0) > 0;
}

export async function canviarEstatUsuari(tenantId: string, usuariId: string, actiu: boolean): Promise<boolean> {
  const { rowCount } = await getDomainPool().query(
    `UPDATE public.tenant_users
        SET actiu = $3, intents_fallits = 0, bloquejat_fins = NULL
      WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [usuariId, tenantId, actiu]
  );
  return (rowCount ?? 0) > 0;
}
