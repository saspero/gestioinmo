import type { PoolClient } from 'pg';
import { buildLimitOffsetClause, buildOrderByClause, buildMeta } from './pagination';
import { BusinessRuleError } from './business-error';
import type {
  CrearPagament,
  ActualitzarPagament,
  CobrarPagament,
  CrearRemesa,
  LlistarPagamentsQuery,
} from '../validations/pagaments';

export interface Pagament {
  id: string;
  contracteId: string;
  remesaId: string | null;
  concepte: string;
  import: string;
  dataVenciment: string;
  dataCobrament: string | null;
  metode: string | null;
  estat: string;
  createdAt: string;
  updatedAt: string;
}

const PAGAMENT_COLUMNS = `
  id, contracte_id AS "contracteId", remesa_id AS "remesaId", concepte, import,
  data_venciment AS "dataVenciment", data_cobrament AS "dataCobrament", metode, estat,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const PAGAMENTS_SORT_COLUMNS = ['data_venciment', 'import', 'estat', 'created_at'] as const;

export async function llistarPagaments(
  client: PoolClient,
  query: LlistarPagamentsQuery
): Promise<{ data: Pagament[]; meta: { page: number; pageSize: number; total: number } }> {
  const conditions: string[] = ['deleted_at IS NULL'];
  const values: unknown[] = [];

  if (query.estat) { values.push(query.estat); conditions.push(`estat = $${values.length}`); }
  if (query.contracteId) { values.push(query.contracteId); conditions.push(`contracte_id = $${values.length}`); }
  if (query.remesaId) { values.push(query.remesaId); conditions.push(`remesa_id = $${values.length}`); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const orderBy = buildOrderByClause(query, PAGAMENTS_SORT_COLUMNS, 'data_venciment');
  const { clause: limitOffset, values: limitOffsetValues } = buildLimitOffsetClause(query, values.length + 1);

  const { rows } = await client.query<Pagament>(
    `SELECT ${PAGAMENT_COLUMNS} FROM pagaments ${where} ${orderBy} ${limitOffset}`,
    [...values, ...limitOffsetValues]
  );
  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM pagaments ${where}`,
    values
  );

  return { data: rows, meta: buildMeta(query, Number(countRows[0]?.total ?? 0)) };
}

export async function obtenirPagament(client: PoolClient, id: string): Promise<Pagament | null> {
  const { rows } = await client.query<Pagament>(
    `SELECT ${PAGAMENT_COLUMNS} FROM pagaments WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

export async function crearPagament(client: PoolClient, input: CrearPagament): Promise<Pagament> {
  const { rows } = await client.query<Pagament>(
    `INSERT INTO pagaments (contracte_id, concepte, import, data_venciment)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PAGAMENT_COLUMNS}`,
    [input.contracteId, input.concepte, input.import, input.dataVenciment]
  );
  return rows[0];
}

export async function actualitzarPagament(
  client: PoolClient,
  id: string,
  input: ActualitzarPagament
): Promise<Pagament | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (input.concepte !== undefined) push('concepte', input.concepte);
  if (input.dataVenciment !== undefined) push('data_venciment', input.dataVenciment);

  if (sets.length === 0) return obtenirPagament(client, id);

  values.push(id);
  const { rows } = await client.query<Pagament>(
    `UPDATE pagaments SET ${sets.join(', ')}
      WHERE id = $${values.length} AND deleted_at IS NULL AND estat NOT IN ('cobrat', 'regularitzat')
      RETURNING ${PAGAMENT_COLUMNS}`,
    values
  );
  if (rows.length === 0) {
    const existing = await obtenirPagament(client, id);
    if (existing && ['cobrat', 'regularitzat'].includes(existing.estat)) {
      throw new BusinessRuleError('No es pot modificar un rebut ja cobrat.');
    }
    return existing;
  }
  return rows[0];
}

export async function cobrarPagament(client: PoolClient, id: string, input: CobrarPagament): Promise<Pagament | null> {
  const { rows } = await client.query<Pagament>(
    `UPDATE pagaments SET estat = 'cobrat', data_cobrament = $2, metode = $3
      WHERE id = $1 AND deleted_at IS NULL AND estat IN ('pendent', 'remesa', 'vencut', 'mora')
      RETURNING ${PAGAMENT_COLUMNS}`,
    [id, input.dataCobrament, input.metode]
  );
  if (rows.length === 0) {
    const existing = await obtenirPagament(client, id);
    if (!existing) return null;
    throw new BusinessRuleError('Aquest rebut ja està cobrat o regularitzat.');
  }
  return rows[0];
}

export async function anularPagament(client: PoolClient, id: string): Promise<boolean> {
  // Mai DELETE físic d'un rebut cobrat (docs/db-schema.md §3.11): l'anul·lació és
  // sempre un soft delete, amb rastre automàtic a l'auditoria (trigger de 008_auditoria.sql).
  const { rowCount } = await client.query(
    'UPDATE pagaments SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// --- Remeses ---

export interface Remesa {
  id: string;
  referencia: string;
  dataGeneracio: string;
  dataEnviament: string | null;
  createdAt: string;
  updatedAt: string;
}

const REMESA_COLUMNS = `
  id, referencia, data_generacio AS "dataGeneracio", data_enviament AS "dataEnviament",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

export async function crearRemesa(client: PoolClient, input: CrearRemesa): Promise<Remesa> {
  const { rows } = await client.query<Remesa>(
    `INSERT INTO remeses (referencia, data_enviament) VALUES ($1, $2) RETURNING ${REMESA_COLUMNS}`,
    [input.referencia, input.dataEnviament ?? null]
  );
  const remesa = rows[0];

  const { rowCount } = await client.query(
    `UPDATE pagaments SET remesa_id = $1, estat = 'remesa'
      WHERE id = ANY($2::uuid[]) AND deleted_at IS NULL AND estat = 'pendent'`,
    [remesa.id, input.pagamentsIds]
  );

  if ((rowCount ?? 0) !== input.pagamentsIds.length) {
    throw new BusinessRuleError(
      "Algun dels rebuts indicats no existeix, ja pertany a una altra remesa o no està pendent."
    );
  }

  return remesa;
}

export async function obtenirRemesa(client: PoolClient, id: string): Promise<Remesa | null> {
  const { rows } = await client.query<Remesa>(`SELECT ${REMESA_COLUMNS} FROM remeses WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
