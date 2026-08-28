// Punt únic on es materialitza el contracte de multitenancy (docs/architecture.md §7):
// cap altre fitxer del projecte fixa `search_path` ni les variables `app.tenant_id` /
// `app.current_user_id` manualment.
//
// El `Pool` es demana a `src/lib/db/pool.ts` (`getDomainPool`), que resol
// DATABASE_URL_DEV/DATABASE_URL_STAGING/DATABASE_URL_PROD segons l'entorn en lloc d'una
// única `DATABASE_URL`. Auth i domini comparteixen així el mateix pool físic per procés;
// aquest mòdul ja no en crea un de propi.
//
// Nota: `getDomainPool` resol l'entorn a partir de `VERCEL_ENV`, no de `NODE_ENV`
// (vegeu `src/lib/db/pool.ts::resolveEnv`) — fora de l'abast d'aquest fitxer.

import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { getDomainPool } from '../db/pool';
import type { JwtPayload } from './jwt';

const uuidSchema = z.string().uuid();

/** Pool compartit (`src/lib/db/pool.ts`) per a les consultes globals de `session.ts`. */
export function getAuthPool(): Pool {
  return getDomainPool();
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

  const client = await getDomainPool().connect();
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
