// Recuperació de contrasenya per correu. El token només viatja a l'enllaç del correu: a
// la BD se'n desa el hash SHA-256 (`public.tenant_user_password_resets`, migració 025).
// Caduca als 30 minuts i només es pot fer servir un cop.

import { createHash, randomBytes } from 'node:crypto';
import { getAuthPool } from './tenant-context';
import { hashPassword } from './password';
import type { LoginMeta } from './session';

import { MAX_RECUPERACIONS_PER_HORA, MINUTS_VALIDESA_RECUPERACIO } from './recuperacio-constants';

export { MAX_RECUPERACIONS_PER_HORA, MINUTS_VALIDESA_RECUPERACIO };

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SollicitudRecuperacio {
  token: string;
  email: string;
  nom: string;
}

/**
 * Crea un enllaç de recuperació per a l'usuari actiu amb aquest email. Retorna `null`
 * si no n'hi ha cap o si ja n'ha demanat massa: qui crida ha de respondre igual en tots
 * els casos, perquè no es pugui saber quins emails estan donats d'alta.
 * Els enllaços anteriors encara vigents deixen de valer.
 */
export async function sollicitarRecuperacio(
  email: string,
  meta: LoginMeta = {}
): Promise<SollicitudRecuperacio | null> {
  const pool = getAuthPool();
  const { rows } = await pool.query<{ id: string; email: string; nom: string; recents: number }>(
    `SELECT tu.id, tu.email, tu.nom,
            (SELECT count(*)::int FROM public.tenant_user_password_resets r
              WHERE r.tenant_user_id = tu.id AND r.created_at > now() - interval '1 hour') AS recents
       FROM public.tenant_users tu
      WHERE tu.email = $1 AND tu.actiu AND tu.deleted_at IS NULL
      ORDER BY tu.created_at ASC
      LIMIT 1`,
    [email]
  );
  const usuari = rows[0];
  if (!usuari || usuari.recents >= MAX_RECUPERACIONS_PER_HORA) return null;

  const token = randomBytes(32).toString('base64url');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE public.tenant_user_password_resets SET used_at = now()
        WHERE tenant_user_id = $1 AND used_at IS NULL AND expires_at > now()`,
      [usuari.id]
    );
    await client.query(
      `INSERT INTO public.tenant_user_password_resets (tenant_user_id, token_hash, ip_address, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
      [usuari.id, hashToken(token), meta.ipAddress ?? null, MINUTS_VALIDESA_RECUPERACIO]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return { token, email: usuari.email, nom: usuari.nom };
}

/** Diu si un token encara es pot fer servir, per mostrar el formulari o l'avís de caducat. */
export async function tokenRecuperacioVigent(token: string): Promise<boolean> {
  const { rows } = await getAuthPool().query(
    `SELECT 1
       FROM public.tenant_user_password_resets r
       JOIN public.tenant_users tu ON tu.id = r.tenant_user_id
      WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > now()
        AND tu.actiu AND tu.deleted_at IS NULL`,
    [hashToken(token)]
  );
  return rows.length > 0;
}

/**
 * Posa la contrasenya nova si el token és vigent i el gasta. També desbloqueja el compte
 * (qui té accés al correu és el titular) i tanca totes les sessions obertes.
 */
export async function restablirAmbToken(token: string, nova: string): Promise<boolean> {
  const nouHash = await hashPassword(nova);
  const client = await getAuthPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id: string; tenant_user_id: string }>(
      `SELECT r.id, r.tenant_user_id
         FROM public.tenant_user_password_resets r
         JOIN public.tenant_users tu ON tu.id = r.tenant_user_id
        WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > now()
          AND tu.actiu AND tu.deleted_at IS NULL
        FOR UPDATE OF r`,
      [hashToken(token)]
    );
    const reset = rows[0];
    if (!reset) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(`UPDATE public.tenant_user_password_resets SET used_at = now() WHERE id = $1`, [reset.id]);
    await client.query(
      `UPDATE public.tenant_users
          SET password_hash = $2, intents_fallits = 0, bloquejat_fins = NULL, canvi_contrasenya_obligatori = false
        WHERE id = $1`,
      [reset.tenant_user_id, nouHash]
    );
    await client.query(
      `UPDATE public.tenant_user_sessions SET revoked_at = now()
        WHERE tenant_user_id = $1 AND revoked_at IS NULL`,
      [reset.tenant_user_id]
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
