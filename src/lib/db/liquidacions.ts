import type { PoolClient } from 'pg';
import { buildLimitOffsetClause, buildOrderByClause, buildMeta } from './pagination';
import { BusinessRuleError } from './business-error';
import {
  importsCobrament,
  percentDe,
  type GenerarLiquidacions,
  type LlistarLiquidacionsQuery,
  type PagarLiquidacio,
} from '../validations/liquidacions';

export interface Liquidacio {
  id: string;
  propietariId: string;
  propietariNom: string;
  periodeInici: string;
  periodeFi: string;
  totalCobrat: string;
  totalDespeses: string;
  comissioAgencia: string;
  ivaComissio: string;
  netALiquidar: string;
  dataPagament: string | null;
  generatEl: string;
}

export interface LiniaLiquidacio {
  id: string;
  tipus: 'cobrament' | 'despesa';
  propietatId: string;
  pagamentId: string | null;
  despesaId: string | null;
  data: string;
  descripcio: string;
  importTotal: string;
  percentatge: string;
  import: string;
  baseComissio: string;
  comissio: string;
  iva: string;
}

const LIQUIDACIO_COLUMNS = `
  l.id, l.propietari_id AS "propietariId",
  concat_ws(' ', pe.nom, pe.cognoms) AS "propietariNom",
  l.periode_inici::text AS "periodeInici", l.periode_fi::text AS "periodeFi",
  l.total_cobrat AS "totalCobrat", l.total_despeses AS "totalDespeses",
  l.comissio_agencia AS "comissioAgencia", l.iva_comissio AS "ivaComissio",
  l.net_a_liquidar AS "netALiquidar", l.data_pagament::text AS "dataPagament",
  l.generat_el AS "generatEl"
`;
const LIQUIDACIO_FROM = 'liquidacions l JOIN persones pe ON pe.id = l.propietari_id';

const LIQUIDACIONS_SORT_COLUMNS = ['periode_inici', 'generat_el', 'net_a_liquidar'] as const;

export async function llistarLiquidacions(
  client: PoolClient,
  query: LlistarLiquidacionsQuery
): Promise<{ data: Liquidacio[]; meta: { page: number; pageSize: number; total: number } }> {
  const values: unknown[] = [];
  const conditions: string[] = [];
  if (query.propietariId) {
    values.push(query.propietariId);
    conditions.push(`l.propietari_id = $${values.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  // Per defecte, les més recents primer.
  const orderBy = query.sort
    ? buildOrderByClause(query, LIQUIDACIONS_SORT_COLUMNS, 'generat_el').replace('ORDER BY ', 'ORDER BY l.')
    : 'ORDER BY l.generat_el DESC';
  const { clause: limitOffset, values: limitOffsetValues } = buildLimitOffsetClause(query, values.length + 1);

  const { rows } = await client.query<Liquidacio>(
    `SELECT ${LIQUIDACIO_COLUMNS} FROM ${LIQUIDACIO_FROM} ${where} ${orderBy} ${limitOffset}`,
    [...values, ...limitOffsetValues]
  );
  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM liquidacions l ${where}`,
    values
  );
  return { data: rows, meta: buildMeta(query, Number(countRows[0]?.total ?? 0)) };
}

export async function obtenirLiquidacio(client: PoolClient, id: string): Promise<Liquidacio | null> {
  const { rows } = await client.query<Liquidacio>(
    `SELECT ${LIQUIDACIO_COLUMNS} FROM ${LIQUIDACIO_FROM} WHERE l.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function llistarLiniesLiquidacio(client: PoolClient, id: string): Promise<LiniaLiquidacio[]> {
  const { rows } = await client.query<LiniaLiquidacio>(
    `SELECT id, CASE WHEN pagament_id IS NOT NULL THEN 'cobrament' ELSE 'despesa' END AS tipus,
            propietat_id AS "propietatId", pagament_id AS "pagamentId", despesa_id AS "despesaId",
            data::text AS data, descripcio, import_total AS "importTotal", percentatge, import,
            base_comissio AS "baseComissio", comissio, iva
       FROM liquidacio_linies WHERE liquidacio_id = $1
      ORDER BY (pagament_id IS NULL), data, created_at`,
    [id]
  );
  return rows;
}

interface Pendent {
  propietariId: string;
  propietatId: string;
  pagamentId: string | null;
  despesaId: string | null;
  data: string;
  descripcio: string;
  importTotal: string;
  rendaTotal: string;
  percentatge: string;
  comissio: string;
}

/**
 * Crea una liquidació per a cada propietari amb rebuts cobrats (per data de cobrament) o
 * despeses a càrrec seu (per data de la despesa) dins del període i encara no liquidats.
 * Cada import es reparteix pel percentatge de titularitat del propietari.
 */
export async function generarLiquidacions(client: PoolClient, input: GenerarLiquidacions): Promise<Liquidacio[]> {
  const params = [input.periodeInici, input.periodeFi, input.propietariId ?? null];

  const { rows: cobraments } = await client.query<Pendent>(
    `SELECT pp.persona_id AS "propietariId", pr.id AS "propietatId", p.id AS "pagamentId", NULL AS "despesaId",
            p.data_cobrament::text AS data, p.concepte || ' · ' || pr.adreca AS descripcio,
            p.import::text AS "importTotal",
            (CASE WHEN EXISTS (SELECT 1 FROM pagament_linies li WHERE li.pagament_id = p.id)
                  THEN COALESCE((SELECT sum(li.import) FROM pagament_linies li
                                  WHERE li.pagament_id = p.id AND li.tipus = 'renda'), 0)
                  ELSE p.import END)::text AS "rendaTotal",
            pp.percentatge::text AS percentatge,
            COALESCE(pr.comissio_percentatge, 0)::text AS comissio
       FROM pagaments p
       JOIN contractes c ON c.id = p.contracte_id
       JOIN unitats u ON u.id = c.unitat_id
       JOIN propietats pr ON pr.id = u.propietat_id
       JOIN propietat_propietaris pp ON pp.propietat_id = pr.id
      WHERE p.deleted_at IS NULL AND p.estat IN ('cobrat', 'regularitzat')
        AND p.data_cobrament BETWEEN $1::date AND $2::date
        AND ($3::uuid IS NULL OR pp.persona_id = $3::uuid)
        AND NOT EXISTS (
          SELECT 1 FROM liquidacio_linies ll WHERE ll.pagament_id = p.id AND ll.propietari_id = pp.persona_id
        )
      ORDER BY p.data_cobrament, p.created_at`,
    params
  );

  const { rows: despeses } = await client.query<Pendent>(
    `SELECT pp.persona_id AS "propietariId", pr.id AS "propietatId", NULL AS "pagamentId", d.id AS "despesaId",
            d.data_despesa::text AS data, d.concepte || ' · ' || pr.adreca AS descripcio,
            d.import::text AS "importTotal", '0' AS "rendaTotal",
            pp.percentatge::text AS percentatge, '0' AS comissio
       FROM despeses d
       JOIN propietats pr ON pr.id = d.propietat_id
       JOIN propietat_propietaris pp ON pp.propietat_id = pr.id
      WHERE d.deleted_at IS NULL AND d.repercutible_propietari
        AND d.data_despesa BETWEEN $1::date AND $2::date
        AND ($3::uuid IS NULL OR pp.persona_id = $3::uuid)
        AND NOT EXISTS (
          SELECT 1 FROM liquidacio_linies ll WHERE ll.despesa_id = d.id AND ll.propietari_id = pp.persona_id
        )
      ORDER BY d.data_despesa, d.created_at`,
    params
  );

  const perPropietari = new Map<string, Pendent[]>();
  for (const fila of [...cobraments, ...despeses]) {
    const llista = perPropietari.get(fila.propietariId) ?? [];
    llista.push(fila);
    perPropietari.set(fila.propietariId, llista);
  }

  const creades: Liquidacio[] = [];
  for (const [propietariId, files] of perPropietari) {
    const linies = files.map((fila) => {
      const percentatge = Number(fila.percentatge);
      const imports = fila.pagamentId
        ? importsCobrament(Number(fila.importTotal), Number(fila.rendaTotal), percentatge, Number(fila.comissio))
        : { import: percentDe(Number(fila.importTotal), percentatge), baseComissio: 0, comissio: 0, iva: 0 };
      return { ...fila, ...imports };
    });

    // En cèntims per no arrossegar errors de coma flotant.
    const suma = (valors: number[]) => valors.reduce((total, valor) => total + Math.round(valor * 100), 0);
    const cobrat = suma(linies.filter((l) => l.pagamentId).map((l) => l.import));
    const despesesTotal = suma(linies.filter((l) => l.despesaId).map((l) => l.import));
    const comissio = suma(linies.map((l) => l.comissio));
    const iva = suma(linies.map((l) => l.iva));
    const net = cobrat - despesesTotal - comissio - iva;

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO liquidacions (propietari_id, periode_inici, periode_fi, total_cobrat, total_despeses,
                                 comissio_agencia, iva_comissio, net_a_liquidar)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        propietariId,
        input.periodeInici,
        input.periodeFi,
        (cobrat / 100).toFixed(2),
        (despesesTotal / 100).toFixed(2),
        (comissio / 100).toFixed(2),
        (iva / 100).toFixed(2),
        (net / 100).toFixed(2),
      ]
    );
    const liquidacioId = rows[0].id;

    await client.query(
      `INSERT INTO liquidacio_linies (liquidacio_id, propietari_id, propietat_id, pagament_id, despesa_id, data,
                                      descripcio, import_total, percentatge, import, base_comissio, comissio, iva)
       SELECT $1, $2, l.propietat_id, l.pagament_id, l.despesa_id, l.data, l.descripcio, l.import_total,
              l.percentatge, l.import, l.base_comissio, l.comissio, l.iva
         FROM unnest($3::uuid[], $4::uuid[], $5::uuid[], $6::date[], $7::text[], $8::numeric[], $9::numeric[],
                     $10::numeric[], $11::numeric[], $12::numeric[], $13::numeric[])
           AS l(propietat_id, pagament_id, despesa_id, data, descripcio, import_total, percentatge, import,
                base_comissio, comissio, iva)`,
      [
        liquidacioId,
        propietariId,
        linies.map((l) => l.propietatId),
        linies.map((l) => l.pagamentId),
        linies.map((l) => l.despesaId),
        linies.map((l) => l.data),
        linies.map((l) => l.descripcio),
        linies.map((l) => l.importTotal),
        linies.map((l) => l.percentatge),
        linies.map((l) => l.import.toFixed(2)),
        linies.map((l) => l.baseComissio.toFixed(2)),
        linies.map((l) => l.comissio.toFixed(2)),
        linies.map((l) => l.iva.toFixed(2)),
      ]
    );

    const liquidacio = await obtenirLiquidacio(client, liquidacioId);
    if (liquidacio) creades.push(liquidacio);
  }

  return creades;
}

export async function pagarLiquidacio(
  client: PoolClient,
  id: string,
  input: PagarLiquidacio
): Promise<Liquidacio | null> {
  const { rowCount } = await client.query(
    'UPDATE liquidacions SET data_pagament = $2 WHERE id = $1 AND data_pagament IS NULL',
    [id, input.dataPagament]
  );
  const liquidacio = await obtenirLiquidacio(client, id);
  if (liquidacio && (rowCount ?? 0) === 0) {
    throw new BusinessRuleError('Aquesta liquidació ja està pagada.');
  }
  return liquidacio;
}

/**
 * Esborra una liquidació encara no pagada. Els rebuts i les despeses que contenia tornen
 * a quedar pendents de liquidar. L'esborrat queda a l'auditoria.
 */
export async function esborrarLiquidacio(client: PoolClient, id: string): Promise<boolean> {
  const liquidacio = await obtenirLiquidacio(client, id);
  if (!liquidacio) return false;
  if (liquidacio.dataPagament) {
    throw new BusinessRuleError('No es pot esborrar una liquidació ja pagada.');
  }
  await client.query('DELETE FROM liquidacions WHERE id = $1', [id]);
  return true;
}
