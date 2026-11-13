import type { PoolClient } from 'pg';
import { buildLimitOffsetClause, buildOrderByClause, buildMeta } from './pagination';
import { BusinessRuleError } from './business-error';
import type {
  CrearPagament,
  ActualitzarPagament,
  CobrarPagament,
  CrearRemesa,
  GenerarRebuts,
  LlistarPagamentsQuery,
} from '../validations/pagaments';
import { concepteRebut } from '../validations/pagaments';

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
  /** Mes (YYYY-MM) d'un rebut generat; null si es va crear a mà. */
  periode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiniaPagament {
  id: string;
  concepteId: string | null;
  tipus: string;
  descripcio: string;
  import: string;
}

const PAGAMENT_COLUMNS = `
  id, contracte_id AS "contracteId", remesa_id AS "remesaId", concepte, import,
  data_venciment::text AS "dataVenciment", data_cobrament::text AS "dataCobrament", metode, estat,
  to_char(periode, 'YYYY-MM') AS periode, created_at AS "createdAt", updated_at AS "updatedAt"
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

// --- Rebuts mensuals amb línies ---

const NOM_TIPUS_CONCEPTE: Record<string, string> = {
  renda: 'Renda',
  escombraries: "Taxa d'escombraries",
  comunitat: 'Comunitat',
  ibi: 'IBI',
  subministraments: 'Subministraments',
  altres: 'Altres',
};

interface ConcepteDelMes {
  contracteId: string;
  ref: string;
  teRebut: boolean;
  concepteId: string | null;
  tipus: string | null;
  descripcio: string | null;
  periodicitat: string | null;
  mesCobrament: number | null;
  import: string | null;
}

function descripcioLinia(concepte: ConcepteDelMes): string {
  const tipus = concepte.tipus ?? 'altres';
  const base =
    tipus === 'altres'
      ? concepte.descripcio || 'Altres'
      : concepte.descripcio
        ? `${NOM_TIPUS_CONCEPTE[tipus]} (${concepte.descripcio})`
        : NOM_TIPUS_CONCEPTE[tipus];
  if (concepte.periodicitat !== 'anual') return base;
  return concepte.mesCobrament === null ? `${base}, part mensual (1/12)` : `${base}, anual`;
}

export interface ResultatGenerarRebuts {
  periode: string;
  creats: number;
  jaExistien: number;
}

/**
 * Genera el rebut del mes de cada contracte actiu que encara no en té. Cada rebut porta
 * una línia per la renda i per cada despesa repercutida, amb l'import vigent el dia 1
 * del mes (o el dia d'inici, el primer mes del contracte). Una despesa anual es cobra
 * sencera el seu mes, o una dotzena part cada mes si no en té. Es pot tornar a executar:
 * els contractes que ja tenen el rebut del mes se salten.
 */
export async function generarRebuts(client: PoolClient, input: GenerarRebuts): Promise<ResultatGenerarRebuts> {
  const inici = `${input.periode}-01`;
  const { rows } = await client.query<ConcepteDelMes>(
    `WITH mes AS (
       SELECT $1::date AS inici, ($1::date + interval '1 month')::date - 1 AS fi
     ),
     contractes_mes AS (
       SELECT c.id, greatest(mes.inici, c.data_inici) AS ref,
              EXISTS (
                SELECT 1 FROM pagaments p
                 WHERE p.contracte_id = c.id AND p.periode = mes.inici AND p.deleted_at IS NULL
              ) AS te_rebut
         FROM contractes c CROSS JOIN mes
        WHERE c.estat = 'actiu' AND c.deleted_at IS NULL AND c.data_inici <= mes.fi
     )
     SELECT cm.id AS "contracteId", cm.ref::text AS ref, cm.te_rebut AS "teRebut",
            cc.id AS "concepteId", cc.tipus, cc.descripcio, cc.periodicitat,
            cc.mes_cobrament AS "mesCobrament",
            (CASE WHEN cc.periodicitat = 'anual' AND cc.mes_cobrament IS NULL
                  THEN round(cc.import / 12, 2) ELSE cc.import END)::text AS import
       FROM contractes_mes cm
       CROSS JOIN mes
       LEFT JOIN contracte_conceptes cc
         ON cc.contracte_id = cm.id
        AND cc.vigent_des_de <= cm.ref
        AND (cc.vigent_fins IS NULL OR cc.vigent_fins >= cm.ref)
        AND (cc.periodicitat = 'mensual' OR cc.mes_cobrament IS NULL
             OR cc.mes_cobrament = extract(month FROM mes.inici))
      ORDER BY cm.id, (cc.tipus = 'renda') DESC, cc.created_at`,
    [inici]
  );

  const perContracte = new Map<string, ConcepteDelMes[]>();
  for (const row of rows) {
    const llista = perContracte.get(row.contracteId) ?? [];
    llista.push(row);
    perContracte.set(row.contracteId, llista);
  }

  const concepte = concepteRebut(input.periode);
  let creats = 0;
  let jaExistien = 0;

  for (const [contracteId, conceptes] of perContracte) {
    if (conceptes[0].teRebut) {
      jaExistien += 1;
      continue;
    }
    const linies = conceptes.filter((c) => c.concepteId !== null && Number(c.import) > 0);
    if (linies.length === 0) continue;

    // En cèntims per no arrossegar errors de coma flotant.
    const totalCentims = linies.reduce((suma, l) => suma + Math.round(Number(l.import) * 100), 0);

    const { rows: inserits } = await client.query<{ id: string }>(
      `INSERT INTO pagaments (contracte_id, concepte, import, data_venciment, periode)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (contracte_id, periode) WHERE periode IS NOT NULL AND deleted_at IS NULL DO NOTHING
       RETURNING id`,
      [contracteId, concepte, (totalCentims / 100).toFixed(2), conceptes[0].ref, inici]
    );
    if (inserits.length === 0) {
      jaExistien += 1;
      continue;
    }

    await client.query(
      `INSERT INTO pagament_linies (pagament_id, concepte_id, tipus, descripcio, import, ordre)
       SELECT $1, l.concepte_id, l.tipus, l.descripcio, l.import, l.ordre
         FROM unnest($2::uuid[], $3::tipus_concepte[], $4::text[], $5::numeric[], $6::int[])
           AS l(concepte_id, tipus, descripcio, import, ordre)`,
      [
        inserits[0].id,
        linies.map((l) => l.concepteId),
        linies.map((l) => l.tipus),
        linies.map(descripcioLinia),
        linies.map((l) => l.import),
        linies.map((_l, index) => index),
      ]
    );
    creats += 1;
  }

  return { periode: input.periode, creats, jaExistien };
}

export async function llistarLiniesPagament(client: PoolClient, pagamentId: string): Promise<LiniaPagament[]> {
  const { rows } = await client.query<LiniaPagament>(
    `SELECT id, concepte_id AS "concepteId", tipus, descripcio, import
       FROM pagament_linies WHERE pagament_id = $1 ORDER BY ordre, created_at`,
    [pagamentId]
  );
  return rows;
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
