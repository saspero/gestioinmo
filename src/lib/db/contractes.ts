import type { PoolClient } from 'pg';
import { buildLimitOffsetClause, buildOrderByClause, buildMeta } from './pagination';
import { BusinessRuleError } from './business-error';
import type {
  CrearContracte,
  ActualitzarContracte,
  ResoldreContracte,
  LlistarContractesQuery,
} from '../validations/contractes';

export interface Contracte {
  id: string;
  unitatId: string;
  tipusUs: string;
  dataInici: string;
  dataFi: string | null;
  renda: string;
  fianca: string;
  indexActualitzacio: string;
  percentatgePactat: string | null;
  estat: string;
  documentUrl: string | null;
  motiuResolucio: string | null;
  dataResolucio: string | null;
  createdAt: string;
  updatedAt: string;
}

const CONTRACTE_COLUMNS = `
  id, unitat_id AS "unitatId", tipus_us AS "tipusUs", data_inici AS "dataInici",
  data_fi AS "dataFi", renda, fianca, index_actualitzacio AS "indexActualitzacio",
  percentatge_pactat AS "percentatgePactat", estat, document_url AS "documentUrl",
  motiu_resolucio AS "motiuResolucio", data_resolucio AS "dataResolucio",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const CONTRACTES_SORT_COLUMNS = ['data_inici', 'renda', 'estat', 'created_at'] as const;

export async function llistarContractes(
  client: PoolClient,
  query: LlistarContractesQuery
): Promise<{ data: Contracte[]; meta: { page: number; pageSize: number; total: number } }> {
  const conditions: string[] = ['deleted_at IS NULL'];
  const values: unknown[] = [];

  if (query.estat) { values.push(query.estat); conditions.push(`estat = $${values.length}`); }
  if (query.unitatId) { values.push(query.unitatId); conditions.push(`unitat_id = $${values.length}`); }
  if (query.tipusUs) { values.push(query.tipusUs); conditions.push(`tipus_us = $${values.length}`); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const orderBy = buildOrderByClause(query, CONTRACTES_SORT_COLUMNS, 'created_at');
  const { clause: limitOffset, values: limitOffsetValues } = buildLimitOffsetClause(query, values.length + 1);

  const { rows } = await client.query<Contracte>(
    `SELECT ${CONTRACTE_COLUMNS} FROM contractes ${where} ${orderBy} ${limitOffset}`,
    [...values, ...limitOffsetValues]
  );
  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM contractes ${where}`,
    values
  );

  return { data: rows, meta: buildMeta(query, Number(countRows[0]?.total ?? 0)) };
}

export async function obtenirContracte(client: PoolClient, id: string): Promise<Contracte | null> {
  const { rows } = await client.query<Contracte>(
    `SELECT ${CONTRACTE_COLUMNS} FROM contractes WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

export async function llistarInquilinsContracte(client: PoolClient, contracteId: string): Promise<string[]> {
  const { rows } = await client.query<{ personaId: string }>(
    'SELECT persona_id AS "personaId" FROM contracte_inquilins WHERE contracte_id = $1',
    [contracteId]
  );
  return rows.map((row) => row.personaId);
}

export async function crearContracte(client: PoolClient, input: CrearContracte): Promise<Contracte> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO contractes (unitat_id, tipus_us, data_inici, data_fi, renda, fianca, index_actualitzacio, percentatge_pactat, document_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      input.unitatId,
      input.tipusUs,
      input.dataInici,
      input.dataFi ?? null,
      input.renda,
      input.fianca,
      input.indexActualitzacio,
      input.percentatgePactat ?? null,
      input.documentUrl ?? null,
    ]
  );
  const contracteId = rows[0].id;

  for (const personaId of input.inquilinsIds) {
    await client.query('INSERT INTO contracte_inquilins (contracte_id, persona_id) VALUES ($1, $2)', [
      contracteId,
      personaId,
    ]);
  }

  const contracte = await obtenirContracte(client, contracteId);
  if (!contracte) throw new Error("No s'ha pogut recuperar el contracte acabat de crear.");
  return contracte;
}

export async function actualitzarContracte(
  client: PoolClient,
  id: string,
  input: ActualitzarContracte
): Promise<Contracte | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (input.dataFi !== undefined) push('data_fi', input.dataFi);
  if (input.renda !== undefined) push('renda', input.renda);
  if (input.fianca !== undefined) push('fianca', input.fianca);
  if (input.indexActualitzacio !== undefined) push('index_actualitzacio', input.indexActualitzacio);
  if (input.percentatgePactat !== undefined) push('percentatge_pactat', input.percentatgePactat);
  if (input.documentUrl !== undefined) push('document_url', input.documentUrl);
  if (input.estat !== undefined) push('estat', input.estat);

  if (sets.length === 0) {
    return obtenirContracte(client, id);
  }

  values.push(id);
  const { rows } = await client.query<Contracte>(
    `UPDATE contractes SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL
     RETURNING ${CONTRACTE_COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

export async function resoldreContracte(
  client: PoolClient,
  id: string,
  input: ResoldreContracte
): Promise<Contracte | null> {
  const { rows } = await client.query<Contracte>(
    `UPDATE contractes SET estat = 'resolt', motiu_resolucio = $2, data_resolucio = $3
      WHERE id = $1 AND deleted_at IS NULL AND estat = 'actiu'
      RETURNING ${CONTRACTE_COLUMNS}`,
    [id, input.motiuResolucio, input.dataResolucio]
  );
  if (rows.length === 0) {
    const existing = await obtenirContracte(client, id);
    if (!existing) return null;
    throw new BusinessRuleError('Només es pot resoldre un contracte que estigui actiu.');
  }
  return rows[0];
}

export async function donarBaixaContracte(client: PoolClient, id: string): Promise<boolean> {
  const { rowCount } = await client.query(
    'UPDATE contractes SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return (rowCount ?? 0) > 0;
}
