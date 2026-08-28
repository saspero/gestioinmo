// Punt únic on es materialitza el contracte de multitenancy (docs/architecture.md §7):
// cap altre fitxer del projecte fixa `search_path` ni les variables `app.tenant_id` /
// `app.current_user_id` manualment.
//
// Nota d'abast: aquest pool és propietat de l'Auth Specialist i només l'usen les
// consultes del propi mòdul (`session.ts`) contra les taules globals `public.tenants` /
// `public.tenant_users` / `public.tenant_user_sessions`. El pool de domini per a
// `src/lib/db/[modul].ts` (amb la configuració per entorn de docs/db-schema.md §7.2-7.3)
// és responsabilitat de l'Agent API Engineer i viu fora d'aquest directori.

import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';
import type { JwtPayload } from './jwt';

const uuidSchema = z.string().uuid();

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL no configurada.');
    }
    pool = new Pool({ connectionString });
    pool.on('error', (err) => {
      // Evita tombar el procés per un error de connexió inactiva del pool.
      console.error('Error inesperat al pool de connexions (auth):', err);
    });
  }
  return pool;
}

/** Pool compartit pel mòdul d'auth (`session.ts`) per a consultes sobre `public.*`. */
export function getAuthPool(): Pool {
  return getPool();
}

/**
 * Obre una transacció, fixa el `search_path` de l'schema del tenant i les variables de
 * sessió (`app.tenant_id`, `app.current_user_id`) usades per les polítiques RLS i la
 * funció d'auditoria, i executa `fn` dins d'aquest context.
 *
 * S'usa `set_config(..., true)` (paràmetre `is_local = true`, equivalent a `SET LOCAL`)
 * en lloc de `SET LOCAL search_path TO $1`, perquè `SET` no accepta paràmetres
 * vinculats (bind parameters) del driver `pg` — `set_config` és una funció normal i sí
 * els accepta, evitant qualsevol concatenació de strings a la sentència SQL.
 */
export async function withTenantContext<T>(
  payload: Pick<JwtPayload, 'tenant_id' | 'sub'>,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const tenantId = uuidSchema.parse(payload.tenant_id);
  const currentUserId = uuidSchema.parse(payload.sub);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('search_path', $1, true)", [`tenant_${tenantId}, public`]);
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [currentUserId]);

    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
