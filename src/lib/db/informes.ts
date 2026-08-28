import type { PoolClient } from 'pg';
import type { DashboardQuery, RecursExport } from '../validations/informes';

export interface DashboardIndicadors {
  ocupacio: { totalUnitats: number; unitatsOcupades: number; percentatge: number };
  morositat: { inquilinsMorosos: number; importPendentMora: string };
  ingressos: { previst: string; cobrat: string };
  incidenciesObertes: number;
}

/**
 * Indicadors clau del dashboard (docs/requirements.md 3.8): ocupació, morositat,
 * ingressos previstos vs. cobrats, incidències obertes. El filtre per propietat/
 * propietari (§3.8, "filtrar els indicadors per rang de dates, propietat o propietari")
 * s'aplica a l'indicador d'ocupació, que és directament sobre `unitats`; ingressos,
 * morositat i incidències es mantenen a nivell de tenant sencer en aquesta primera
 * passada — filtrar-los pel mateix criteri requeriria encadenar joins
 * unitat→contracte→pagament/incidència i queda fora de l'abast d'aquest pas.
 */
export async function obtenirDashboard(client: PoolClient, query: DashboardQuery): Promise<DashboardIndicadors> {
  let propietatIds: string[] | null = null;
  if (query.propietariId) {
    const { rows } = await client.query<{ propietatId: string }>(
      'SELECT propietat_id AS "propietatId" FROM propietat_propietaris WHERE persona_id = $1',
      [query.propietariId]
    );
    propietatIds = rows.map((row) => row.propietatId);
  } else if (query.propietatId) {
    propietatIds = [query.propietatId];
  }

  const unitatsFilter = propietatIds ? 'AND u.propietat_id = ANY($1::uuid[])' : '';
  const unitatsValues = propietatIds ? [propietatIds] : [];

  const { rows: ocupacioRows } = await client.query<{ total: string; ocupades: string }>(
    `SELECT count(*)::text AS total, count(*) FILTER (WHERE u.estat = 'ocupat')::text AS ocupades
       FROM unitats u WHERE u.deleted_at IS NULL ${unitatsFilter}`,
    unitatsValues
  );
  const totalUnitats = Number(ocupacioRows[0]?.total ?? 0);
  const unitatsOcupades = Number(ocupacioRows[0]?.ocupades ?? 0);

  const { rows: morositatRows } = await client.query<{ inquilins: string }>(
    "SELECT count(*)::text AS inquilins FROM persones WHERE tipus = 'inquili' AND estat_inquili = 'moros' AND deleted_at IS NULL"
  );

  const { rows: importMoraRows } = await client.query<{ total: string }>(
    "SELECT COALESCE(sum(import), 0)::text AS total FROM pagaments WHERE estat = 'mora' AND deleted_at IS NULL"
  );

  const dataConditions: string[] = ['deleted_at IS NULL'];
  const dataValues: unknown[] = [];
  if (query.dataInici) {
    dataValues.push(query.dataInici);
    dataConditions.push(`data_venciment >= $${dataValues.length}`);
  }
  if (query.dataFi) {
    dataValues.push(query.dataFi);
    dataConditions.push(`data_venciment <= $${dataValues.length}`);
  }

  const { rows: ingressosRows } = await client.query<{ previst: string; cobrat: string }>(
    `SELECT COALESCE(sum(import), 0)::text AS previst,
            COALESCE(sum(import) FILTER (WHERE estat IN ('cobrat', 'regularitzat')), 0)::text AS cobrat
       FROM pagaments WHERE ${dataConditions.join(' AND ')}`,
    dataValues
  );

  const { rows: incidenciesRows } = await client.query<{ obertes: string }>(
    "SELECT count(*)::text AS obertes FROM incidencies WHERE estat IN ('oberta', 'assignada', 'en_curs') AND deleted_at IS NULL"
  );

  return {
    ocupacio: {
      totalUnitats,
      unitatsOcupades,
      percentatge: totalUnitats > 0 ? Math.round((unitatsOcupades / totalUnitats) * 10000) / 100 : 0,
    },
    morositat: {
      inquilinsMorosos: Number(morositatRows[0]?.inquilins ?? 0),
      importPendentMora: importMoraRows[0]?.total ?? '0',
    },
    ingressos: {
      previst: ingressosRows[0]?.previst ?? '0',
      cobrat: ingressosRows[0]?.cobrat ?? '0',
    },
    incidenciesObertes: Number(incidenciesRows[0]?.obertes ?? 0),
  };
}

export interface DadesExportacio {
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

const EXPORT_ROW_LIMIT = 5000;

function getEncryptionKey(): string {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key) throw new Error('DB_ENCRYPTION_KEY no configurada.');
  return key;
}

/** Dades planes per a `GET /api/informes/[recurs]/export` (docs/agents/AGENT_API.md §2).
 *  Cap resultat pot incloure dades d'un altre tenant (docs/requirements.md §4): ho
 *  garanteix el mateix `search_path` de tenant que la resta de queries, no cap filtre
 *  addicional aquí. */
export async function obtenirDadesExportacio(client: PoolClient, recurs: RecursExport): Promise<DadesExportacio> {
  switch (recurs) {
    case 'propietats': {
      const { rows } = await client.query(
        `SELECT referencia, tipus, adreca, poblacio, cp, superficie, habitacions, banys, ascensor
           FROM propietats WHERE deleted_at IS NULL ORDER BY referencia ASC LIMIT $1`,
        [EXPORT_ROW_LIMIT]
      );
      return {
        headers: ['referencia', 'tipus', 'adreca', 'poblacio', 'cp', 'superficie', 'habitacions', 'banys', 'ascensor'],
        rows,
      };
    }
    case 'propietaris':
    case 'inquilins': {
      const tipus = recurs === 'propietaris' ? 'propietari' : 'inquili';
      const key = getEncryptionKey();
      const { rows } = await client.query(
        `SELECT nom, cognoms, pgp_sym_decrypt(nif_enc, $1) AS nif, telefon,
                pgp_sym_decrypt(email_enc, $1) AS email, adreca
           FROM persones WHERE tipus = $2 AND deleted_at IS NULL ORDER BY nom ASC LIMIT $3`,
        [key, tipus, EXPORT_ROW_LIMIT]
      );
      return { headers: ['nom', 'cognoms', 'nif', 'telefon', 'email', 'adreca'], rows };
    }
    case 'contractes': {
      const { rows } = await client.query(
        `SELECT id, unitat_id AS "unitatId", tipus_us AS "tipusUs", data_inici AS "dataInici",
                data_fi AS "dataFi", renda, fianca, estat
           FROM contractes WHERE deleted_at IS NULL ORDER BY data_inici DESC LIMIT $1`,
        [EXPORT_ROW_LIMIT]
      );
      return { headers: ['id', 'unitatId', 'tipusUs', 'dataInici', 'dataFi', 'renda', 'fianca', 'estat'], rows };
    }
    case 'pagaments': {
      const { rows } = await client.query(
        `SELECT id, contracte_id AS "contracteId", concepte, import, data_venciment AS "dataVenciment",
                data_cobrament AS "dataCobrament", estat
           FROM pagaments WHERE deleted_at IS NULL ORDER BY data_venciment DESC LIMIT $1`,
        [EXPORT_ROW_LIMIT]
      );
      return { headers: ['id', 'contracteId', 'concepte', 'import', 'dataVenciment', 'dataCobrament', 'estat'], rows };
    }
    case 'incidencies': {
      const { rows } = await client.query(
        `SELECT id, unitat_id AS "unitatId", titol, prioritat, estat, cost_final AS "costFinal", created_at AS "createdAt"
           FROM incidencies WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1`,
        [EXPORT_ROW_LIMIT]
      );
      return { headers: ['id', 'unitatId', 'titol', 'prioritat', 'estat', 'costFinal', 'createdAt'], rows };
    }
  }
}
