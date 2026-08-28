import type { PoolClient } from 'pg';
import { buildLimitOffsetClause, buildOrderByClause, buildMeta } from './pagination';
import { BusinessRuleError } from './business-error';
import type { CrearDespesa, ActualitzarDespesa, LlistarDespesesQuery } from '../validations/despeses';

export interface Despesa {
  id: string;
  propietatId: string;
  unitatId: string | null;
  incidenciaId: string | null;
  categoria: string;
  concepte: string;
  import: string;
  dataDespesa: string;
  proveidor: string | null;
  facturaUrl: string | null;
  repercutiblePropietari: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const DESPESA_COLUMNS = `
  id, propietat_id AS "propietatId", unitat_id AS "unitatId", incidencia_id AS "incidenciaId",
  categoria, concepte, import, data_despesa AS "dataDespesa", proveidor, factura_url AS "facturaUrl",
  repercutible_propietari AS "repercutiblePropietari", notes,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const DESPESES_SORT_COLUMNS = ['data_despesa', 'categoria', 'import', 'created_at'] as const;

/** docs/agents/AGENT_API.md §8: relació unitat/propietat no expressable amb un CHECK
 *  entre taules — es verifica aquí, com `assertUsuariMateixTenant` a incidencies.ts. */
async function assertUnitatPertanyPropietat(client: PoolClient, unitatId: string, propietatId: string): Promise<void> {
  const { rows } = await client.query<{ existeix: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM unitats WHERE id = $1 AND propietat_id = $2 AND deleted_at IS NULL) AS existeix',
    [unitatId, propietatId]
  );
  if (!rows[0]?.existeix) {
    throw new BusinessRuleError('La unitat indicada no pertany a la propietat de la despesa.');
  }
}

export async function llistarDespeses(
  client: PoolClient,
  query: LlistarDespesesQuery
): Promise<{ data: Despesa[]; meta: { page: number; pageSize: number; total: number } }> {
  const conditions: string[] = ['deleted_at IS NULL'];
  const values: unknown[] = [];

  if (query.propietatId) { values.push(query.propietatId); conditions.push(`propietat_id = $${values.length}`); }
  if (query.unitatId) { values.push(query.unitatId); conditions.push(`unitat_id = $${values.length}`); }
  if (query.incidenciaId) { values.push(query.incidenciaId); conditions.push(`incidencia_id = $${values.length}`); }
  if (query.categoria) { values.push(query.categoria); conditions.push(`categoria = $${values.length}`); }
  if (query.dataInici) { values.push(query.dataInici); conditions.push(`data_despesa >= $${values.length}`); }
  if (query.dataFi) { values.push(query.dataFi); conditions.push(`data_despesa <= $${values.length}`); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const orderBy = buildOrderByClause(query, DESPESES_SORT_COLUMNS, 'data_despesa');
  const { clause: limitOffset, values: limitOffsetValues } = buildLimitOffsetClause(query, values.length + 1);

  const { rows } = await client.query<Despesa>(
    `SELECT ${DESPESA_COLUMNS} FROM despeses ${where} ${orderBy} ${limitOffset}`,
    [...values, ...limitOffsetValues]
  );
  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM despeses ${where}`,
    values
  );

  return { data: rows, meta: buildMeta(query, Number(countRows[0]?.total ?? 0)) };
}

export async function obtenirDespesa(client: PoolClient, id: string): Promise<Despesa | null> {
  const { rows } = await client.query<Despesa>(
    `SELECT ${DESPESA_COLUMNS} FROM despeses WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

export async function crearDespesa(client: PoolClient, input: CrearDespesa): Promise<Despesa> {
  if (input.unitatId) {
    await assertUnitatPertanyPropietat(client, input.unitatId, input.propietatId);
  }

  const { rows } = await client.query<Despesa>(
    `INSERT INTO despeses (propietat_id, unitat_id, incidencia_id, categoria, concepte, import, data_despesa, proveidor, factura_url, repercutible_propietari, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${DESPESA_COLUMNS}`,
    [
      input.propietatId,
      input.unitatId ?? null,
      input.incidenciaId ?? null,
      input.categoria,
      input.concepte,
      input.import,
      input.dataDespesa,
      input.proveidor ?? null,
      input.facturaUrl ?? null,
      input.repercutiblePropietari,
      input.notes ?? null,
    ]
  );
  return rows[0];
}

export async function actualitzarDespesa(
  client: PoolClient,
  id: string,
  input: ActualitzarDespesa
): Promise<Despesa | null> {
  if (input.unitatId !== undefined) {
    const actual = await obtenirDespesa(client, id);
    if (!actual) return null;
    await assertUnitatPertanyPropietat(client, input.unitatId, actual.propietatId);
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (input.unitatId !== undefined) push('unitat_id', input.unitatId);
  if (input.incidenciaId !== undefined) push('incidencia_id', input.incidenciaId);
  if (input.categoria !== undefined) push('categoria', input.categoria);
  if (input.concepte !== undefined) push('concepte', input.concepte);
  if (input.import !== undefined) push('import', input.import);
  if (input.dataDespesa !== undefined) push('data_despesa', input.dataDespesa);
  if (input.proveidor !== undefined) push('proveidor', input.proveidor);
  if (input.facturaUrl !== undefined) push('factura_url', input.facturaUrl);
  if (input.repercutiblePropietari !== undefined) push('repercutible_propietari', input.repercutiblePropietari);
  if (input.notes !== undefined) push('notes', input.notes);

  if (sets.length === 0) return obtenirDespesa(client, id);

  values.push(id);
  const { rows } = await client.query<Despesa>(
    `UPDATE despeses SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL
     RETURNING ${DESPESA_COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

export async function donarBaixaDespesa(client: PoolClient, id: string): Promise<boolean> {
  const { rowCount } = await client.query(
    'UPDATE despeses SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return (rowCount ?? 0) > 0;
}
