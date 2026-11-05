// Crea una base de dades d'usar i llençar amb l'estat global de les migracions. Els tests
// que l'usen només corren si hi ha TEST_DATABASE_URL (a CI, el servei Postgres del workflow).

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

const MIGRACIONS = path.join(process.cwd(), 'db', 'migrations');

async function sql(fitxer: string): Promise<string> {
  return readFile(path.join(MIGRACIONS, fitxer), 'utf8');
}

export async function crearBdTest(adminUrl: string): Promise<{ url: string; eliminar: () => Promise<void> }> {
  const nom = `gestinmo_test_${randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${nom}`);

  const url = new URL(adminUrl);
  url.pathname = `/${nom}`;

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(await sql('001_tenants.sql'));
  await client.query(await sql('002_auth.sql'));
  // pgaudit és una extensió de Supabase: no existeix al Postgres de CI.
  const rls = (await sql('010_rls.sql')).replace(/DO \$\$ BEGIN\s+CREATE EXTENSION IF NOT EXISTS pgaudit;[\s\S]*?END \$\$;/, '');
  await client.query(rls);
  await client.query(await sql('012_extensions_schema.sql'));
  await client.end();

  return {
    url: url.toString(),
    eliminar: async () => {
      await admin.query(`DROP DATABASE IF EXISTS ${nom} WITH (FORCE)`);
      await admin.end();
    },
  };
}
