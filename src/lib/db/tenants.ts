// Provisioning de tenants (docs/db-schema.md §1.2) i dades globals del tenant/usuari.
//
// El provisioning llegeix `db/migrations/` del disc: és per a l'script
// `scripts/create-tenant.ts`, no per a route handlers (aquests fitxers no viatgen al
// bundle de Vercel). Necessita una connexió directa o de "session pooler": fixa el
// `search_path` a nivell de sessió, cosa que el transaction pooler de Supabase no manté.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { hashPassword } from '../auth/password';
import { logger } from '../logger';
import { provisionarTenantSchema, type ProvisionarTenantInput } from '../validations/tenants';
import { getDomainPool } from './pool';

const MIGRACIONS_TENANT = [
  '003_propietats.sql',
  '004_persones.sql',
  '005_contractes.sql',
  '006_pagaments.sql',
  '007_incidencies.sql',
  '008_auditoria.sql',
  '009_indexes.sql',
  '011_tenant_despeses.sql',
  '013_contractes_fianca_lliure.sql',
  '015_pagaments_marge_venciment.sql',
  '017_persones_juridiques.sql',
] as const;

export interface TenantProvisionat {
  tenantId: string;
  /** `false` si el tenant ja existia i només s'hi ha afegit l'administrador. */
  tenantNou: boolean;
}

async function comprovarExtensions(client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ total: number }>(
    `SELECT count(*)::int AS total
       FROM pg_extension e
       JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname = ANY($1) AND n.nspname = 'extensions'`,
    [['pgcrypto', 'pg_trgm']]
  );
  if (rows[0]?.total !== 2) {
    throw new Error("Falten extensions a l'schema `extensions`: cal aplicar 012_extensions_schema.sql.");
  }
}

async function crearSchemaTenant(client: PoolClient, tenantId: string, migrationsDir: string): Promise<void> {
  const schema = client.escapeIdentifier(`tenant_${tenantId}`);
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query("SELECT set_config('search_path', $1, false)", [`${schema}, public, extensions`]);
  for (const fitxer of MIGRACIONS_TENANT) {
    await client.query(await readFile(path.join(migrationsDir, fitxer), 'utf8'));
  }
}

/**
 * Crea el tenant, el seu schema i el primer administrador. Si el slug ja existeix,
 * reutilitza el tenant i només hi afegeix l'administrador (cas del tenant `demo`).
 * Les migracions porten el seu propi BEGIN/COMMIT, així que una fallada es compensa
 * eliminant explícitament l'schema i la fila del tenant nou.
 */
export async function provisionarTenant(
  input: ProvisionarTenantInput,
  migrationsDir = path.join(process.cwd(), 'db', 'migrations')
): Promise<TenantProvisionat> {
  const { nom, slug, admin } = provisionarTenantSchema.parse(input);
  const passwordHash = await hashPassword(admin.password);
  const client = await getDomainPool().connect();
  let tenantId: string | undefined;
  let tenantNou = false;

  try {
    await comprovarExtensions(client);

    const existent = await client.query<{ id: string }>('SELECT id FROM public.tenants WHERE slug = $1', [slug]);
    tenantId = existent.rows[0]?.id;

    if (!tenantId) {
      const creat = await client.query<{ id: string }>(
        'INSERT INTO public.tenants (nom, slug) VALUES ($1, $2) RETURNING id',
        [nom, slug]
      );
      tenantId = creat.rows[0].id;
      tenantNou = true;
      await crearSchemaTenant(client, tenantId, migrationsDir);
    }

    await client.query(
      `INSERT INTO public.tenant_users (tenant_id, email, password_hash, nom, cognoms, rol, canvi_contrasenya_obligatori)
       VALUES ($1, $2, $3, $4, $5, 'admin', $6)`,
      [tenantId, admin.email, passwordHash, admin.nom, admin.cognoms ?? null, admin.canviContrasenya]
    );

    logger.info('Tenant provisionat', { tenantId, tenantNou });
    return { tenantId, tenantNou };
  } catch (error) {
    if (tenantNou && tenantId) {
      await client.query('ROLLBACK').catch(() => undefined);
      await client.query(`DROP SCHEMA IF EXISTS ${client.escapeIdentifier(`tenant_${tenantId}`)} CASCADE`);
      await client.query('DELETE FROM public.tenants WHERE id = $1', [tenantId]);
    }
    throw error;
  } finally {
    // Es destrueix la connexió: el `search_path` de sessió no ha de tornar al pool.
    client.release(true);
  }
}

export interface ContextUsuari {
  tenantNom: string;
  usuariNom: string;
}

/** Nom de l'agència i de l'usuari per a la capçalera del dashboard. */
export async function obtenirContextUsuari(tenantId: string, tenantUserId: string): Promise<ContextUsuari | null> {
  const { rows } = await getDomainPool().query<ContextUsuari>(
    `SELECT t.nom AS "tenantNom", concat_ws(' ', tu.nom, tu.cognoms) AS "usuariNom"
       FROM public.tenant_users tu
       JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.id = $1 AND tu.tenant_id = $2 AND tu.actiu AND tu.deleted_at IS NULL`,
    [tenantUserId, tenantId]
  );
  return rows[0] ?? null;
}
