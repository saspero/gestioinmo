// Pool de connexions de domini (docs/db-schema.md §7.2-7.3), responsabilitat de l'Agent
// API Engineer. Diferent del pool de l'Auth Specialist (src/lib/auth/tenant-context.ts,
// `getAuthPool`), que només consulta les taules globals `public.*`. Totes les funcions
// de `src/lib/db/[domini].ts` reben el `client` obert per `withTenantContext` — cap
// n'obre un de propi — però aquell helper necessita un `Pool` per obtenir connexions.

import { Pool } from 'pg';
import { logger } from '../logger';

interface PoolEnvConfig {
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statement_timeout: number;
}

type Entorn = 'development' | 'preview' | 'production';

const POOL_CONFIG: Record<Entorn, PoolEnvConfig> = {
  development: { max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, statement_timeout: 10_000 },
  preview: { max: 10, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, statement_timeout: 10_000 },
  production: { max: 20, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, statement_timeout: 8_000 },
};

function resolveEnv(): Entorn {
  const env = process.env.VERCEL_ENV;
  return env === 'production' || env === 'preview' ? env : 'development';
}

function resolveConnectionString(env: Entorn): string {
  const varName = env === 'production' ? 'DATABASE_URL_PROD' : env === 'preview' ? 'DATABASE_URL_STAGING' : 'DATABASE_URL_DEV';
  const connectionString = process.env[varName];
  if (!connectionString) {
    throw new Error(`${varName} no configurada.`);
  }
  return connectionString;
}

let pool: Pool | undefined;

/** Pool únic per procés per a les queries de domini de `src/lib/db/[domini].ts`. */
export function getDomainPool(): Pool {
  if (!pool) {
    const env = resolveEnv();
    pool = new Pool({ connectionString: resolveConnectionString(env), ...POOL_CONFIG[env] });
    pool.on('error', (err) => {
      // Mai deixar que una connexió inactiva caiguda pel servidor tombi el procés.
      logger.error('Error inesperat al pool de connexions de domini', { error: err.message });
    });
  }
  return pool;
}
