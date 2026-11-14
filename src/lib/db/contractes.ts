import type { PoolClient } from 'pg';
import { buildLimitOffsetClause, buildOrderByClause, buildMeta } from './pagination';
import { BusinessRuleError } from './business-error';
import {
  avisosContracte,
  sumarDies,
  type AvisContracte,
  type CrearContracte,
  type ActualitzarContracte,
  type ResoldreContracte,
  type LlistarContractesQuery,
  type CrearConcepte,
  type ModificarConcepte,
  type BaixaConcepte,
  type CrearGarantia,
} from '../validations/contractes';

export interface Contracte {
  id: string;
  unitatId: string;
  tipusUs: string;
  dataInici: string;
  dataFi: string | null;
  /** Renda vigent avui (l'últim concepte `renda` que ja ha començat). */
  renda: string;
  rendaInicial: string;
  fianca: string;
  indexActualitzacio: string;
  tipusActualitzacio: string;
  percentatgePactat: string | null;
  duradaMesos: number | null;
  prorrogaAutomatica: boolean;
  prorrogaMesos: number | null;
  duradaMaximaMesos: number | null;
  preavisDies: number | null;
  moblat: boolean;
  estat: string;
  documentUrl: string | null;
  motiuResolucio: string | null;
  dataResolucio: string | null;
  darrerCanviRenda: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvisosDeContracte {
  contracteId: string;
  /** Adreça de la propietat, unitat i inquilins, per reconèixer el contracte. */
  nom: string;
  avisos: AvisContracte[];
}

/** Avisos (actualització de renda i no renovació) de tots els contractes actius. */
export async function llistarAvisosContractes(client: PoolClient, avui: string): Promise<AvisosDeContracte[]> {
  const { rows } = await client.query<Contracte & { nom: string }>(
    `SELECT ${CONTRACTE_COLUMNS},
            concat_ws(' · ',
              (SELECT p.adreca || CASE WHEN u.referencia IS NOT NULL AND (
                         SELECT count(*) FROM unitats u2 WHERE u2.propietat_id = p.id AND u2.deleted_at IS NULL) > 1
                       THEN ' (' || u.referencia || ')' ELSE '' END
                 FROM unitats u JOIN propietats p ON p.id = u.propietat_id
                WHERE u.id = contractes.unitat_id),
              (SELECT string_agg(concat_ws(' ', pe.nom, pe.cognoms), ', ' ORDER BY pe.nom)
                 FROM contracte_inquilins ci JOIN persones pe ON pe.id = ci.persona_id
                WHERE ci.contracte_id = contractes.id)
            ) AS nom
       FROM contractes
      WHERE estat = 'actiu' AND deleted_at IS NULL
      ORDER BY data_inici`
  );
  return rows
    .map((contracte) => ({ contracteId: contracte.id, nom: contracte.nom, avisos: avisosContracte(contracte, avui) }))
    .filter((fila) => fila.avisos.length > 0);
}

// `contractes.renda` és la renda inicial; la vigent surt de l'historial de conceptes.
export const RENDA_VIGENT = `COALESCE((
    SELECT cc.import FROM contracte_conceptes cc
     WHERE cc.contracte_id = contractes.id AND cc.tipus = 'renda' AND cc.vigent_des_de <= current_date
       AND (cc.vigent_fins IS NULL OR cc.vigent_fins >= current_date)
     ORDER BY cc.vigent_des_de DESC LIMIT 1
  ), contractes.renda)`;

// Data d'efecte de la renda més recent, també d'un canvi futur ja programat. Serveix per
// saber si l'actualització d'un aniversari ja s'ha aplicat.
const DARRER_CANVI_RENDA = `(
    SELECT max(cc.vigent_des_de)::text FROM contracte_conceptes cc
     WHERE cc.contracte_id = contractes.id AND cc.tipus = 'renda'
  )`;

const CONTRACTE_COLUMNS = `
  id, unitat_id AS "unitatId", tipus_us AS "tipusUs", data_inici::text AS "dataInici",
  data_fi::text AS "dataFi", ${RENDA_VIGENT} AS renda, renda AS "rendaInicial", fianca,
  index_actualitzacio AS "indexActualitzacio", tipus_actualitzacio AS "tipusActualitzacio",
  percentatge_pactat AS "percentatgePactat", durada_mesos AS "duradaMesos",
  prorroga_automatica AS "prorrogaAutomatica", prorroga_mesos AS "prorrogaMesos",
  durada_maxima_mesos AS "duradaMaximaMesos", preavis_dies AS "preavisDies", moblat,
  estat, document_url AS "documentUrl",
  motiu_resolucio AS "motiuResolucio", data_resolucio::text AS "dataResolucio",
  ${DARRER_CANVI_RENDA} AS "darrerCanviRenda",
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
    `INSERT INTO contractes (unitat_id, tipus_us, data_inici, data_fi, renda, fianca, index_actualitzacio, percentatge_pactat,
                             document_url, tipus_actualitzacio, durada_mesos, prorroga_automatica, prorroga_mesos,
                             durada_maxima_mesos, preavis_dies, moblat)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
      input.tipusActualitzacio,
      input.duradaMesos ?? null,
      input.prorrogaAutomatica,
      input.prorrogaMesos ?? null,
      input.duradaMaximaMesos ?? null,
      input.preavisDies ?? null,
      input.moblat,
    ]
  );
  const contracteId = rows[0].id;

  await client.query(
    `INSERT INTO contracte_conceptes (contracte_id, tipus, import, vigent_des_de, motiu)
     VALUES ($1, 'renda', $2, $3, 'Renda inicial')`,
    [contracteId, input.renda, input.dataInici]
  );

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

  if (input.renda !== undefined) {
    // Mentre és un esborrany, la renda es corregeix directament (també la inicial de
    // l'historial). Un cop actiu, un canvi de renda porta data d'efecte.
    const { rows: actual } = await client.query<{ estat: string }>(
      'SELECT estat FROM contractes WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (actual[0] && actual[0].estat !== 'esborrany') {
      throw new BusinessRuleError(
        "La renda d'un contracte actiu es modifica amb una data d'efecte, des de l'apartat Renda i despeses."
      );
    }
    await client.query(
      `UPDATE contracte_conceptes SET import = $2
        WHERE contracte_id = $1 AND tipus = 'renda' AND substitueix_id IS NULL`,
      [id, input.renda]
    );
  }

  if (input.dataFi !== undefined) push('data_fi', input.dataFi);
  if (input.renda !== undefined) push('renda', input.renda);
  if (input.fianca !== undefined) push('fianca', input.fianca);
  if (input.indexActualitzacio !== undefined) push('index_actualitzacio', input.indexActualitzacio);
  if (input.percentatgePactat !== undefined) push('percentatge_pactat', input.percentatgePactat);
  if (input.tipusActualitzacio !== undefined) push('tipus_actualitzacio', input.tipusActualitzacio);
  if (input.duradaMesos !== undefined) {
    push('durada_mesos', input.duradaMesos);
    // Una durada nova recalcula la fi del període inicial, si no se n'indica una altra.
    if (input.duradaMesos !== null && input.dataFi === undefined) {
      sets.push(`data_fi = (data_inici + make_interval(months => $${values.length}::int))::date - 1`);
    }
  }
  if (input.prorrogaAutomatica !== undefined) push('prorroga_automatica', input.prorrogaAutomatica);
  if (input.prorrogaMesos !== undefined) push('prorroga_mesos', input.prorrogaMesos);
  if (input.duradaMaximaMesos !== undefined) push('durada_maxima_mesos', input.duradaMaximaMesos);
  if (input.preavisDies !== undefined) push('preavis_dies', input.preavisDies);
  if (input.moblat !== undefined) push('moblat', input.moblat);
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

// --- Conceptes: renda i despeses repercutides, amb historial ---

export interface Concepte {
  id: string;
  contracteId: string;
  tipus: string;
  descripcio: string | null;
  import: string;
  periodicitat: 'mensual' | 'anual';
  mesCobrament: number | null;
  vigentDesDe: string;
  vigentFins: string | null;
  substitueixId: string | null;
  motiu: string | null;
  createdAt: string;
}

const CONCEPTE_COLUMNS = `
  id, contracte_id AS "contracteId", tipus, descripcio, import, periodicitat,
  mes_cobrament AS "mesCobrament", vigent_des_de::text AS "vigentDesDe", vigent_fins::text AS "vigentFins",
  substitueix_id AS "substitueixId", motiu, created_at AS "createdAt"`;

/** Tot l'historial del contracte: primer la renda, i dins de cada concepte, el més recent primer. */
export async function llistarConceptes(client: PoolClient, contracteId: string): Promise<Concepte[]> {
  const { rows } = await client.query<Concepte>(
    `SELECT ${CONCEPTE_COLUMNS} FROM contracte_conceptes
      WHERE contracte_id = $1
      ORDER BY tipus = 'renda' DESC, tipus, descripcio NULLS FIRST, vigent_des_de DESC`,
    [contracteId]
  );
  return rows;
}

export async function crearConcepte(client: PoolClient, contracteId: string, input: CrearConcepte): Promise<Concepte> {
  const { rows } = await client.query<Concepte>(
    `INSERT INTO contracte_conceptes (contracte_id, tipus, descripcio, import, periodicitat, mes_cobrament, vigent_des_de)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${CONCEPTE_COLUMNS}`,
    [
      contracteId,
      input.tipus,
      input.descripcio ?? null,
      input.import,
      input.periodicitat,
      input.mesCobrament ?? null,
      input.vigentDesDe,
    ]
  );
  return rows[0];
}

/** Només es pot modificar o donar de baixa la fila més recent de cada concepte. */
async function concepteObert(client: PoolClient, contracteId: string, id: string): Promise<Concepte | null> {
  const { rows } = await client.query<Concepte>(
    `SELECT ${CONCEPTE_COLUMNS} FROM contracte_conceptes WHERE id = $1 AND contracte_id = $2 FOR UPDATE`,
    [id, contracteId]
  );
  const concepte = rows[0];
  if (!concepte) return null;
  const { rowCount } = await client.query('SELECT 1 FROM contracte_conceptes WHERE substitueix_id = $1', [id]);
  if ((rowCount ?? 0) > 0) {
    throw new BusinessRuleError("Aquest import ja s'ha substituït per un altre. Modifica el més recent.");
  }
  return concepte;
}

/**
 * Registra un import nou a partir de `dataEfecte`: l'anterior queda vigent fins al dia
 * abans i el nou en conserva el tipus, la periodicitat i el final de vigència.
 */
export async function modificarConcepte(
  client: PoolClient,
  contracteId: string,
  id: string,
  input: ModificarConcepte
): Promise<Concepte | null> {
  const anterior = await concepteObert(client, contracteId, id);
  if (!anterior) return null;
  if (input.dataEfecte <= anterior.vigentDesDe) {
    throw new BusinessRuleError(
      `La data d'efecte ha de ser posterior al ${anterior.vigentDesDe}, quan va començar l'import actual.`
    );
  }
  if (anterior.vigentFins && input.dataEfecte > anterior.vigentFins) {
    throw new BusinessRuleError('Aquesta despesa ja no es cobra en aquella data.');
  }

  await client.query('UPDATE contracte_conceptes SET vigent_fins = $2 WHERE id = $1', [id, sumarDies(input.dataEfecte, -1)]);
  const { rows } = await client.query<Concepte>(
    `INSERT INTO contracte_conceptes
       (contracte_id, tipus, descripcio, import, periodicitat, mes_cobrament, vigent_des_de, vigent_fins, substitueix_id, motiu)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${CONCEPTE_COLUMNS}`,
    [
      contracteId,
      anterior.tipus,
      anterior.descripcio,
      input.import,
      anterior.periodicitat,
      anterior.mesCobrament,
      input.dataEfecte,
      anterior.vigentFins,
      id,
      input.motiu ?? null,
    ]
  );
  return rows[0];
}

/** Deixa de cobrar una despesa a partir de `dataEfecte`. La renda no es pot donar de baixa. */
export async function donarBaixaConcepte(
  client: PoolClient,
  contracteId: string,
  id: string,
  input: BaixaConcepte
): Promise<Concepte | null> {
  const concepte = await concepteObert(client, contracteId, id);
  if (!concepte) return null;
  if (concepte.tipus === 'renda') throw new BusinessRuleError('La renda no es pot donar de baixa.');
  if (concepte.vigentFins && input.dataEfecte > concepte.vigentFins) {
    throw new BusinessRuleError('Aquesta despesa ja no es cobra en aquella data.');
  }
  if (input.dataEfecte <= concepte.vigentDesDe) {
    // Si encara no havia començat, s'esborra: no s'ha arribat a cobrar mai. Si substituïa
    // un import anterior, aquell torna a quedar com el més recent, fins a la mateixa data.
    await client.query('DELETE FROM contracte_conceptes WHERE id = $1', [id]);
    if (concepte.substitueixId) {
      await client.query('UPDATE contracte_conceptes SET vigent_fins = $2 WHERE id = $1', [
        concepte.substitueixId,
        sumarDies(concepte.vigentDesDe, -1),
      ]);
    }
    return { ...concepte, vigentFins: sumarDies(concepte.vigentDesDe, -1) };
  }
  const { rows } = await client.query<Concepte>(
    `UPDATE contracte_conceptes SET vigent_fins = $2 WHERE id = $1 RETURNING ${CONCEPTE_COLUMNS}`,
    [id, sumarDies(input.dataEfecte, -1)]
  );
  return rows[0];
}

// --- Garanties ---

export interface Garantia {
  id: string;
  contracteId: string;
  tipus: string;
  import: string | null;
  entitat: string | null;
  dataVenciment: string | null;
  notes: string | null;
  createdAt: string;
}

const GARANTIA_COLUMNS = `
  id, contracte_id AS "contracteId", tipus, import, entitat, data_venciment::text AS "dataVenciment",
  notes, created_at AS "createdAt"`;

export async function llistarGaranties(client: PoolClient, contracteId: string): Promise<Garantia[]> {
  const { rows } = await client.query<Garantia>(
    `SELECT ${GARANTIA_COLUMNS} FROM contracte_garanties WHERE contracte_id = $1 ORDER BY created_at`,
    [contracteId]
  );
  return rows;
}

export async function crearGarantia(client: PoolClient, contracteId: string, input: CrearGarantia): Promise<Garantia> {
  const { rows } = await client.query<Garantia>(
    `INSERT INTO contracte_garanties (contracte_id, tipus, import, entitat, data_venciment, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${GARANTIA_COLUMNS}`,
    [contracteId, input.tipus, input.import ?? null, input.entitat ?? null, input.dataVenciment ?? null, input.notes ?? null]
  );
  return rows[0];
}

export async function esborrarGarantia(client: PoolClient, contracteId: string, id: string): Promise<boolean> {
  const { rowCount } = await client.query('DELETE FROM contracte_garanties WHERE id = $1 AND contracte_id = $2', [
    id,
    contracteId,
  ]);
  return (rowCount ?? 0) > 0;
}
