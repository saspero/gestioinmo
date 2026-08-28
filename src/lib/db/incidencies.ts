import type { PoolClient } from 'pg';
import { buildLimitOffsetClause, buildOrderByClause, buildMeta } from './pagination';
import { BusinessRuleError } from './business-error';
import type {
  CrearIncidencia,
  ActualitzarIncidencia,
  ResoldreIncidencia,
  CrearComentari,
  LlistarIncidenciesQuery,
} from '../validations/incidencies';

export interface Incidencia {
  id: string;
  unitatId: string;
  contracteId: string | null;
  reportadorId: string | null;
  titol: string;
  descripcio: string | null;
  prioritat: string;
  estat: string;
  assignatA: string | null;
  costEstimat: string | null;
  costFinal: string | null;
  resoltaEl: string | null;
  createdAt: string;
  updatedAt: string;
}

const INCIDENCIA_COLUMNS = `
  id, unitat_id AS "unitatId", contracte_id AS "contracteId", reportador_id AS "reportadorId",
  titol, descripcio, prioritat, estat, assignat_a AS "assignatA",
  cost_estimat AS "costEstimat", cost_final AS "costFinal", resolta_el AS "resoltaEl",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const INCIDENCIES_SORT_COLUMNS = ['prioritat', 'estat', 'created_at'] as const;

export async function llistarIncidencies(
  client: PoolClient,
  query: LlistarIncidenciesQuery
): Promise<{ data: Incidencia[]; meta: { page: number; pageSize: number; total: number } }> {
  const conditions: string[] = ['deleted_at IS NULL'];
  const values: unknown[] = [];

  if (query.estat) { values.push(query.estat); conditions.push(`estat = $${values.length}`); }
  if (query.prioritat) { values.push(query.prioritat); conditions.push(`prioritat = $${values.length}`); }
  if (query.unitatId) { values.push(query.unitatId); conditions.push(`unitat_id = $${values.length}`); }
  if (query.assignatA) { values.push(query.assignatA); conditions.push(`assignat_a = $${values.length}`); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const orderBy = buildOrderByClause(query, INCIDENCIES_SORT_COLUMNS, 'created_at');
  const { clause: limitOffset, values: limitOffsetValues } = buildLimitOffsetClause(query, values.length + 1);

  const { rows } = await client.query<Incidencia>(
    `SELECT ${INCIDENCIA_COLUMNS} FROM incidencies ${where} ${orderBy} ${limitOffset}`,
    [...values, ...limitOffsetValues]
  );
  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM incidencies ${where}`,
    values
  );

  return { data: rows, meta: buildMeta(query, Number(countRows[0]?.total ?? 0)) };
}

export async function obtenirIncidencia(client: PoolClient, id: string): Promise<Incidencia | null> {
  const { rows } = await client.query<Incidencia>(
    `SELECT ${INCIDENCIA_COLUMNS} FROM incidencies WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

export async function crearIncidencia(client: PoolClient, input: CrearIncidencia): Promise<Incidencia> {
  const { rows } = await client.query<Incidencia>(
    `INSERT INTO incidencies (unitat_id, contracte_id, reportador_id, titol, descripcio, prioritat)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${INCIDENCIA_COLUMNS}`,
    [input.unitatId, input.contracteId ?? null, input.reportadorId ?? null, input.titol, input.descripcio ?? null, input.prioritat]
  );
  return rows[0];
}

async function assertUsuariMateixTenant(client: PoolClient, tenantUserId: string): Promise<void> {
  // docs/db-schema.md §1.3: `assignat_a` referencia public.tenant_users amb una FK
  // normal (no expressa "mateix tenant"); l'aplicació ho ha de verificar abans d'assignar.
  const { rows } = await client.query<{ existeix: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM public.tenant_users
       WHERE id = $1 AND tenant_id = current_setting('app.tenant_id')::uuid AND deleted_at IS NULL
     ) AS existeix`,
    [tenantUserId]
  );
  if (!rows[0]?.existeix) {
    throw new BusinessRuleError("L'usuari assignat no pertany a aquest tenant.");
  }
}

export async function actualitzarIncidencia(
  client: PoolClient,
  id: string,
  input: ActualitzarIncidencia
): Promise<Incidencia | null> {
  if (input.assignatA !== undefined) {
    await assertUsuariMateixTenant(client, input.assignatA);
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (input.titol !== undefined) push('titol', input.titol);
  if (input.descripcio !== undefined) push('descripcio', input.descripcio);
  if (input.prioritat !== undefined) push('prioritat', input.prioritat);
  if (input.estat !== undefined) push('estat', input.estat);
  if (input.assignatA !== undefined) push('assignat_a', input.assignatA);
  if (input.costEstimat !== undefined) push('cost_estimat', input.costEstimat);
  if (input.costFinal !== undefined) push('cost_final', input.costFinal);

  if (sets.length === 0) return obtenirIncidencia(client, id);

  values.push(id);
  const { rows } = await client.query<Incidencia>(
    `UPDATE incidencies SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL
     RETURNING ${INCIDENCIA_COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

export async function resoldreIncidencia(
  client: PoolClient,
  id: string,
  input: ResoldreIncidencia
): Promise<Incidencia | null> {
  const { rows } = await client.query<Incidencia>(
    `UPDATE incidencies SET estat = 'resolta', cost_final = COALESCE($2, cost_final)
      WHERE id = $1 AND deleted_at IS NULL AND estat <> 'resolta'
      RETURNING ${INCIDENCIA_COLUMNS}`,
    [id, input.costFinal ?? null]
  );
  if (rows.length === 0) {
    const existing = await obtenirIncidencia(client, id);
    if (!existing) return null;
    throw new BusinessRuleError('Aquesta incidència ja està resolta.');
  }
  return rows[0];
}

export async function donarBaixaIncidencia(client: PoolClient, id: string): Promise<boolean> {
  const { rowCount } = await client.query(
    'UPDATE incidencies SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// --- Comentaris ---

export interface Comentari {
  id: string;
  incidenciaId: string;
  autorPersonaId: string | null;
  autorUsuariId: string | null;
  text: string;
  createdAt: string;
}

const COMENTARI_COLUMNS = `
  id, incidencia_id AS "incidenciaId", autor_persona_id AS "autorPersonaId",
  autor_usuari_id AS "autorUsuariId", text, created_at AS "createdAt"
`;

export async function llistarComentaris(client: PoolClient, incidenciaId: string): Promise<Comentari[]> {
  const { rows } = await client.query<Comentari>(
    `SELECT ${COMENTARI_COLUMNS} FROM incidencia_comentaris WHERE incidencia_id = $1 ORDER BY created_at ASC`,
    [incidenciaId]
  );
  return rows;
}

export async function crearComentari(
  client: PoolClient,
  incidenciaId: string,
  autorUsuariId: string,
  input: CrearComentari
): Promise<Comentari> {
  const { rows } = await client.query<Comentari>(
    `INSERT INTO incidencia_comentaris (incidencia_id, autor_usuari_id, text)
     VALUES ($1, $2, $3)
     RETURNING ${COMENTARI_COLUMNS}`,
    [incidenciaId, autorUsuariId, input.text]
  );
  return rows[0];
}
