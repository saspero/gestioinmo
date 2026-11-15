// Informes de la pestanya Informes (docs/requirements.md §3.8). Cada informe retorna les
// columnes, les files i els totals; la mateixa sortida es pinta a pantalla i s'exporta a
// CSV o PDF (src/app/api/informes/llistats/[informe]/route.ts).

import type { PoolClient } from 'pg';
import { inquilinsDe, nomContracteDe, rendaVigentDe } from './contractes';
import {
  PREAVIS_PER_DEFECTE_DIES,
  aniversariDesDe,
  fiDePeriode,
  properVenciment,
  sumarDies,
  sumarMesos,
} from '../validations/contractes';
import type {
  ColumnaInforme,
  FiltresInforme,
  InformeId,
  ResultatInforme,
  ValorInforme,
} from '../validations/informes';

type Fila = Record<string, ValorInforme>;

const NOM_PROPIETAT = `pr.referencia || ' · ' || pr.adreca`;

/** Condicions de propietat i propietari sobre l'àlies `pr` de `propietats`. */
function filtresPropietat(values: unknown[], filtres: FiltresInforme): string {
  const condicions: string[] = [];
  if (filtres.propietatId) {
    values.push(filtres.propietatId);
    condicions.push(`pr.id = $${values.length}`);
  }
  if (filtres.propietariId) {
    values.push(filtres.propietariId);
    condicions.push(
      `EXISTS (SELECT 1 FROM propietat_propietaris pp WHERE pp.propietat_id = pr.id AND pp.persona_id = $${values.length})`
    );
  }
  return condicions.map((condicio) => ` AND ${condicio}`).join('');
}

const num = (valor: unknown): number => Number(valor ?? 0);
const cents = (valor: number): number => Math.round(valor * 100) / 100;

function resultat(columnes: ColumnaInforme[], files: Fila[]): ResultatInforme {
  const ambTotal = columnes.filter((c) => c.total);
  if (ambTotal.length === 0 || files.length === 0) return { columnes, files, totals: null };
  const totals: Record<string, number> = {};
  for (const columna of ambTotal) {
    totals[columna.id] = cents(files.reduce((suma, fila) => suma + num(fila[columna.id]), 0));
  }
  return { columnes, files, totals };
}

async function ingressos(client: PoolClient, f: FiltresInforme): Promise<ResultatInforme> {
  const values: unknown[] = [f.dataInici, f.dataFi];
  const { rows } = await client.query<{ propietat: string; mes: string; emes: string; cobrat: string | null }>(
    `SELECT ${NOM_PROPIETAT} AS propietat, to_char(p.data_venciment, 'YYYY-MM') AS mes,
            sum(p.import) AS emes,
            sum(p.import) FILTER (WHERE p.estat IN ('cobrat', 'regularitzat')) AS cobrat
       FROM pagaments p
       JOIN contractes c ON c.id = p.contracte_id
       JOIN unitats u ON u.id = c.unitat_id
       JOIN propietats pr ON pr.id = u.propietat_id
      WHERE p.deleted_at IS NULL AND p.data_venciment BETWEEN $1::date AND $2::date
            ${filtresPropietat(values, f)}
      GROUP BY pr.id, pr.referencia, pr.adreca, mes
      ORDER BY pr.referencia, mes`,
    values
  );
  return resultat(
    [
      { id: 'propietat', label: 'Propietat', tipus: 'text' },
      { id: 'mes', label: 'Mes', tipus: 'text' },
      { id: 'emes', label: 'Emès', tipus: 'import', total: true },
      { id: 'cobrat', label: 'Cobrat', tipus: 'import', total: true },
      { id: 'pendent', label: 'Pendent', tipus: 'import', total: true },
    ],
    rows.map((r) => ({
      propietat: r.propietat,
      mes: r.mes,
      emes: num(r.emes),
      cobrat: num(r.cobrat),
      pendent: cents(num(r.emes) - num(r.cobrat)),
    }))
  );
}

async function rendiment(client: PoolClient, f: FiltresInforme): Promise<ResultatInforme> {
  const values: unknown[] = [f.dataInici, f.dataFi];
  const { rows } = await client.query<{ propietat: string; cobrat: string; despeses: string }>(
    `SELECT ${NOM_PROPIETAT} AS propietat,
            COALESCE((SELECT sum(p.import) FROM pagaments p
                        JOIN contractes c ON c.id = p.contracte_id
                        JOIN unitats u ON u.id = c.unitat_id
                       WHERE u.propietat_id = pr.id AND p.deleted_at IS NULL
                         AND p.estat IN ('cobrat', 'regularitzat')
                         AND p.data_cobrament BETWEEN $1::date AND $2::date), 0) AS cobrat,
            COALESCE((SELECT sum(d.import) FROM despeses d
                       WHERE d.propietat_id = pr.id AND d.deleted_at IS NULL
                         AND d.data_despesa BETWEEN $1::date AND $2::date), 0) AS despeses
       FROM propietats pr
      WHERE pr.deleted_at IS NULL ${filtresPropietat(values, f)}
      ORDER BY pr.referencia`,
    values
  );
  return resultat(
    [
      { id: 'propietat', label: 'Propietat', tipus: 'text' },
      { id: 'cobrat', label: 'Cobrat', tipus: 'import', total: true },
      { id: 'despeses', label: 'Despeses', tipus: 'import', total: true },
      { id: 'rendiment', label: 'Rendiment', tipus: 'import', total: true },
    ],
    rows.map((r) => ({
      propietat: r.propietat,
      cobrat: num(r.cobrat),
      despeses: num(r.despeses),
      rendiment: cents(num(r.cobrat) - num(r.despeses)),
    }))
  );
}

async function liquidacions(client: PoolClient, f: FiltresInforme): Promise<ResultatInforme> {
  const values: unknown[] = [f.dataInici, f.dataFi];
  const condicions: string[] = [];
  if (f.propietariId) {
    values.push(f.propietariId);
    condicions.push(`l.propietari_id = $${values.length}`);
  }
  if (f.propietatId) {
    values.push(f.propietatId);
    condicions.push(
      `EXISTS (SELECT 1 FROM liquidacio_linies ll WHERE ll.liquidacio_id = l.id AND ll.propietat_id = $${values.length})`
    );
  }
  const { rows } = await client.query<Record<string, string | null>>(
    `SELECT concat_ws(' ', pe.nom, pe.cognoms) AS propietari,
            l.periode_inici::text || ' — ' || l.periode_fi::text AS periode,
            l.total_cobrat AS cobrat, l.total_despeses AS despeses, l.comissio_agencia AS comissio,
            l.iva_comissio AS iva, l.net_a_liquidar AS net, l.data_pagament::text AS pagada
       FROM liquidacions l JOIN persones pe ON pe.id = l.propietari_id
      WHERE l.periode_inici <= $2::date AND l.periode_fi >= $1::date
            ${condicions.map((c) => ` AND ${c}`).join('')}
      ORDER BY l.periode_inici, propietari`,
    values
  );
  return resultat(
    [
      { id: 'propietari', label: 'Propietari', tipus: 'text' },
      { id: 'periode', label: 'Període', tipus: 'text' },
      { id: 'cobrat', label: 'Cobrat', tipus: 'import', total: true },
      { id: 'despeses', label: 'Despeses', tipus: 'import', total: true },
      { id: 'comissio', label: 'Comissió', tipus: 'import', total: true },
      { id: 'iva', label: 'IVA', tipus: 'import', total: true },
      { id: 'net', label: 'Net', tipus: 'import', total: true },
      { id: 'pagada', label: 'Pagada el', tipus: 'data' },
    ],
    rows.map((r) => ({
      ...r,
      cobrat: num(r.cobrat),
      despeses: num(r.despeses),
      comissio: num(r.comissio),
      iva: num(r.iva),
      net: num(r.net),
    }))
  );
}

async function morositat(client: PoolClient, f: FiltresInforme, avui: string): Promise<ResultatInforme> {
  const values: unknown[] = [avui];
  const { rows } = await client.query<Record<string, string | number | null>>(
    `SELECT ${inquilinsDe('c')} AS inquilins, ${NOM_PROPIETAT} AS propietat, p.concepte,
            p.data_venciment::text AS venciment, p.import, ($1::date - p.data_venciment) AS dies,
            CASE p.estat WHEN 'mora' THEN 'Mora' ELSE 'Vençut' END AS estat
       FROM pagaments p
       JOIN contractes c ON c.id = p.contracte_id
       JOIN unitats u ON u.id = c.unitat_id
       JOIN propietats pr ON pr.id = u.propietat_id
      WHERE p.deleted_at IS NULL AND p.estat IN ('vencut', 'mora') ${filtresPropietat(values, f)}
      ORDER BY dies DESC, inquilins`,
    values
  );
  return resultat(
    [
      { id: 'inquilins', label: 'Inquilí', tipus: 'text' },
      { id: 'propietat', label: 'Propietat', tipus: 'text' },
      { id: 'concepte', label: 'Concepte', tipus: 'text' },
      { id: 'venciment', label: 'Venciment', tipus: 'data' },
      { id: 'dies', label: 'Dies de retard', tipus: 'numero' },
      { id: 'estat', label: 'Estat', tipus: 'text' },
      { id: 'import', label: 'Import', tipus: 'import', total: true },
    ],
    rows.map((r) => ({ ...r, import: num(r.import), dies: num(r.dies) }))
  );
}

interface ContracteActiu {
  id: string;
  nom: string;
  dataInici: string;
  dataFi: string | null;
  duradaMesos: number | null;
  prorrogaAutomatica: boolean;
  prorrogaMesos: number | null;
  duradaMaximaMesos: number | null;
  preavisDies: number | null;
  tipusActualitzacio: string;
  percentatgePactat: string | null;
  renda: string;
}

async function contractesActius(client: PoolClient, f: FiltresInforme): Promise<ContracteActiu[]> {
  const values: unknown[] = [];
  const { rows } = await client.query<ContracteActiu>(
    `SELECT c.id, ${nomContracteDe('c')} AS nom, c.data_inici::text AS "dataInici", c.data_fi::text AS "dataFi",
            c.durada_mesos AS "duradaMesos", c.prorroga_automatica AS "prorrogaAutomatica",
            c.prorroga_mesos AS "prorrogaMesos", c.durada_maxima_mesos AS "duradaMaximaMesos",
            c.preavis_dies AS "preavisDies", c.tipus_actualitzacio AS "tipusActualitzacio",
            c.percentatge_pactat AS "percentatgePactat", ${rendaVigentDe('c')} AS renda
       FROM contractes c
       JOIN unitats u ON u.id = c.unitat_id
       JOIN propietats pr ON pr.id = u.propietat_id
      WHERE c.estat = 'actiu' AND c.deleted_at IS NULL ${filtresPropietat(values, f)}
      ORDER BY c.data_inici`,
    values
  );
  return rows;
}

async function venciments(client: PoolClient, f: FiltresInforme): Promise<ResultatInforme> {
  const files: Fila[] = [];
  for (const c of await contractesActius(client, f)) {
    const venciment = properVenciment(c, f.dataInici);
    if (!venciment || venciment < f.dataInici || venciment > f.dataFi) continue;
    const limitMaxim = c.duradaMaximaMesos ? fiDePeriode(c.dataInici, c.duradaMaximaMesos) : null;
    const acaba = !c.prorrogaAutomatica || !c.prorrogaMesos || venciment === limitMaxim;
    files.push({
      contracte: c.nom,
      venciment,
      que: acaba ? 'Acaba' : 'Es prorroga',
      limit: sumarDies(venciment, -(c.preavisDies ?? PREAVIS_PER_DEFECTE_DIES)),
      renda: num(c.renda),
    });
  }
  files.sort((a, b) => String(a.venciment).localeCompare(String(b.venciment)));
  return resultat(
    [
      { id: 'contracte', label: 'Contracte', tipus: 'text' },
      { id: 'venciment', label: 'Venciment', tipus: 'data' },
      { id: 'que', label: 'Si ningú avisa', tipus: 'text' },
      { id: 'limit', label: 'Límit per no renovar', tipus: 'data' },
      { id: 'renda', label: 'Renda', tipus: 'import' },
    ],
    files
  );
}

const NOM_ACTUALITZACIO: Record<string, string> = { ipc: 'IPC', irav: 'IRAV', percentatge_fix: 'Fix' };

async function actualitzacions(client: PoolClient, f: FiltresInforme, avui: string): Promise<ResultatInforme> {
  const contractes = (await contractesActius(client, f)).filter((c) => c.tipusActualitzacio !== 'cap');
  const { rows: rendes } = await client.query<{ contracteId: string; import: string; desDe: string; fins: string | null }>(
    `SELECT contracte_id AS "contracteId", import, vigent_des_de::text AS "desDe", vigent_fins::text AS fins
       FROM contracte_conceptes WHERE tipus = 'renda' AND contracte_id = ANY($1::uuid[])
      ORDER BY vigent_des_de`,
    [contractes.map((c) => c.id)]
  );

  const files: Fila[] = [];
  for (const c of contractes) {
    const historial = rendes.filter((r) => r.contracteId === c.id);
    for (
      let aniversari = aniversariDesDe(c.dataInici, f.dataInici);
      aniversari <= f.dataFi;
      aniversari = sumarMesos(aniversari, 12)
    ) {
      const abans = sumarDies(aniversari, -1);
      const anterior = historial.find((r) => r.desDe <= abans && (r.fins === null || r.fins >= abans));
      const finsAnySeguent = sumarDies(sumarMesos(aniversari, 12), -1);
      const nova = historial.find((r) => r.desDe >= aniversari && r.desDe <= finsAnySeguent);
      const rendaAnterior = anterior ? num(anterior.import) : null;
      const rendaNova = nova ? num(nova.import) : null;
      const tipus =
        c.tipusActualitzacio === 'percentatge_fix' && c.percentatgePactat !== null
          ? `${Number(c.percentatgePactat)} % fix`
          : NOM_ACTUALITZACIO[c.tipusActualitzacio] ?? c.tipusActualitzacio;
      files.push({
        contracte: c.nom,
        aniversari,
        tipus,
        anterior: rendaAnterior,
        nova: rendaNova,
        variacio:
          rendaAnterior && rendaNova !== null ? cents(((rendaNova - rendaAnterior) / rendaAnterior) * 100) : null,
        estat: nova ? 'Aplicada' : aniversari > avui ? 'Propera' : 'Pendent',
      });
    }
  }
  files.sort((a, b) => String(a.aniversari).localeCompare(String(b.aniversari)));
  return resultat(
    [
      { id: 'contracte', label: 'Contracte', tipus: 'text' },
      { id: 'aniversari', label: 'Aniversari', tipus: 'data' },
      { id: 'tipus', label: 'Índex', tipus: 'text' },
      { id: 'anterior', label: 'Renda anterior', tipus: 'import' },
      { id: 'nova', label: 'Renda nova', tipus: 'import' },
      { id: 'variacio', label: 'Variació', tipus: 'percentatge' },
      { id: 'estat', label: 'Estat', tipus: 'text' },
    ],
    files
  );
}

async function ocupacio(client: PoolClient, f: FiltresInforme, avui: string): Promise<ResultatInforme> {
  const values: unknown[] = [avui];
  const { rows } = await client.query<Record<string, string | number | null>>(
    `SELECT ${NOM_PROPIETAT} AS propietat, u.referencia AS unitat,
            CASE WHEN c.id IS NULL THEN 'Vacant' ELSE 'Llogada' END AS estat,
            ${inquilinsDe('c')} AS inquilins,
            CASE WHEN c.id IS NULL THEN NULL ELSE ${rendaVigentDe('c')} END AS renda,
            buida.des_de::text AS "buidaDesDe",
            CASE WHEN c.id IS NULL AND buida.des_de IS NOT NULL THEN $1::date - buida.des_de END AS dies
       FROM unitats u
       JOIN propietats pr ON pr.id = u.propietat_id
       LEFT JOIN contractes c ON c.unitat_id = u.id AND c.estat = 'actiu' AND c.deleted_at IS NULL
       LEFT JOIN LATERAL (
         SELECT max(COALESCE(c2.data_resolucio, c2.data_fi)) + 1 AS des_de
           FROM contractes c2
          WHERE c2.unitat_id = u.id AND c2.deleted_at IS NULL AND c2.estat IN ('finalitzat', 'resolt')
       ) buida ON true
      WHERE u.deleted_at IS NULL AND pr.deleted_at IS NULL AND u.estat <> 'baixa' ${filtresPropietat(values, f)}
      ORDER BY pr.referencia, u.referencia`,
    values
  );
  return resultat(
    [
      { id: 'propietat', label: 'Propietat', tipus: 'text' },
      { id: 'unitat', label: 'Unitat', tipus: 'text' },
      { id: 'estat', label: 'Estat', tipus: 'text' },
      { id: 'inquilins', label: 'Inquilí', tipus: 'text' },
      { id: 'renda', label: 'Renda', tipus: 'import', total: true },
      { id: 'buidaDesDe', label: 'Buida des del', tipus: 'data' },
      { id: 'dies', label: 'Dies buida', tipus: 'numero' },
    ],
    rows.map((r) => ({
      ...r,
      renda: r.renda === null ? null : num(r.renda),
      dies: r.dies === null ? null : num(r.dies),
      buidaDesDe: r.estat === 'Vacant' ? r.buidaDesDe : null,
    }))
  );
}

const NOM_PRIORITAT: Record<string, string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', urgent: 'Urgent' };
const NOM_ESTAT_INCIDENCIA: Record<string, string> = {
  oberta: 'Oberta',
  assignada: 'Assignada',
  en_curs: 'En curs',
  resolta: 'Resolta',
};

async function incidencies(client: PoolClient, f: FiltresInforme, avui: string): Promise<ResultatInforme> {
  const values: unknown[] = [f.dataInici, f.dataFi, avui];
  const { rows } = await client.query<Record<string, string | number | null>>(
    `SELECT ${NOM_PROPIETAT} AS propietat, i.titol, i.prioritat, i.estat,
            i.created_at::date::text AS oberta, i.resolta_el::date::text AS resolta,
            CASE WHEN i.estat <> 'resolta' THEN $3::date - i.created_at::date END AS dies,
            COALESCE(i.cost_final, (SELECT sum(d.import) FROM despeses d
                                     WHERE d.incidencia_id = i.id AND d.deleted_at IS NULL)) AS cost
       FROM incidencies i
       JOIN unitats u ON u.id = i.unitat_id
       JOIN propietats pr ON pr.id = u.propietat_id
      WHERE i.deleted_at IS NULL
        AND (i.estat <> 'resolta' OR i.resolta_el::date BETWEEN $1::date AND $2::date)
        ${filtresPropietat(values, f)}
      ORDER BY (i.estat = 'resolta'), i.created_at`,
    values
  );
  return resultat(
    [
      { id: 'propietat', label: 'Propietat', tipus: 'text' },
      { id: 'titol', label: 'Incidència', tipus: 'text' },
      { id: 'prioritat', label: 'Prioritat', tipus: 'text' },
      { id: 'estat', label: 'Estat', tipus: 'text' },
      { id: 'oberta', label: 'Oberta el', tipus: 'data' },
      { id: 'dies', label: 'Dies oberta', tipus: 'numero' },
      { id: 'resolta', label: 'Resolta el', tipus: 'data' },
      { id: 'cost', label: 'Cost', tipus: 'import', total: true },
    ],
    rows.map((r) => ({
      ...r,
      prioritat: NOM_PRIORITAT[String(r.prioritat)] ?? r.prioritat,
      estat: NOM_ESTAT_INCIDENCIA[String(r.estat)] ?? r.estat,
      dies: r.dies === null ? null : num(r.dies),
      cost: r.cost === null ? null : num(r.cost),
    }))
  );
}

export async function obtenirInforme(
  client: PoolClient,
  id: InformeId,
  filtres: FiltresInforme,
  avui: string
): Promise<ResultatInforme> {
  switch (id) {
    case 'ingressos':
      return ingressos(client, filtres);
    case 'rendiment':
      return rendiment(client, filtres);
    case 'liquidacions':
      return liquidacions(client, filtres);
    case 'morositat':
      return morositat(client, filtres, avui);
    case 'venciments':
      return venciments(client, filtres);
    case 'actualitzacions':
      return actualitzacions(client, filtres, avui);
    case 'ocupacio':
      return ocupacio(client, filtres, avui);
    case 'incidencies':
      return incidencies(client, filtres, avui);
  }
}
