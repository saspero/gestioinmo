import type { PoolClient } from 'pg';
import { buildLimitOffsetClause, buildOrderByClause, buildMeta } from './pagination';
import { BusinessRuleError } from './business-error';
import type {
  CrearPropietat,
  ActualitzarPropietat,
  LlistarPropietatsQuery,
  CrearUnitat,
  ActualitzarUnitat,
} from '../validations/propietats';

export interface Propietat {
  id: string;
  referencia: string;
  tipus: string;
  adreca: string;
  poblacio: string | null;
  cp: string | null;
  superficie: string | null;
  habitacions: number | null;
  banys: number | null;
  ascensor: boolean;
  certEnergetic: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const PROPIETAT_COLUMNS = `
  id, referencia, tipus, adreca, poblacio, cp, superficie, habitacions, banys,
  ascensor, cert_energetic AS "certEnergetic", notes,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const PROPIETATS_SORT_COLUMNS = ['referencia', 'tipus', 'poblacio', 'created_at'] as const;

export async function llistarPropietats(
  client: PoolClient,
  query: LlistarPropietatsQuery
): Promise<{ data: Propietat[]; meta: { page: number; pageSize: number; total: number } }> {
  const conditions: string[] = ['deleted_at IS NULL'];
  const values: unknown[] = [];

  if (query.tipus) {
    values.push(query.tipus);
    conditions.push(`tipus = $${values.length}`);
  }
  if (query.poblacio) {
    values.push(query.poblacio);
    conditions.push(`poblacio = $${values.length}`);
  }
  if (query.q) {
    values.push(`%${query.q}%`);
    conditions.push(`(referencia ILIKE $${values.length} OR adreca ILIKE $${values.length})`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const orderBy = buildOrderByClause(query, PROPIETATS_SORT_COLUMNS, 'created_at');
  const { clause: limitOffset, values: limitOffsetValues } = buildLimitOffsetClause(query, values.length + 1);

  const { rows } = await client.query<Propietat>(
    `SELECT ${PROPIETAT_COLUMNS} FROM propietats ${where} ${orderBy} ${limitOffset}`,
    [...values, ...limitOffsetValues]
  );
  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM propietats ${where}`,
    values
  );

  return { data: rows, meta: buildMeta(query, Number(countRows[0]?.total ?? 0)) };
}

export async function obtenirPropietat(client: PoolClient, id: string): Promise<Propietat | null> {
  const { rows } = await client.query<Propietat>(
    `SELECT ${PROPIETAT_COLUMNS} FROM propietats WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

async function substituirTitulars(
  client: PoolClient,
  propietatId: string,
  titulars: { personaId: string; percentatge: number }[]
): Promise<void> {
  await client.query('DELETE FROM propietat_propietaris WHERE propietat_id = $1', [propietatId]);
  for (const titular of titulars) {
    await client.query(
      'INSERT INTO propietat_propietaris (propietat_id, persona_id, percentatge) VALUES ($1, $2, $3)',
      [propietatId, titular.personaId, titular.percentatge]
    );
  }
}

export async function crearPropietat(client: PoolClient, input: CrearPropietat): Promise<Propietat> {
  const { rows } = await client.query<Propietat>(
    `INSERT INTO propietats (referencia, tipus, adreca, poblacio, cp, superficie, habitacions, banys, ascensor, cert_energetic, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${PROPIETAT_COLUMNS}`,
    [
      input.referencia,
      input.tipus,
      input.adreca,
      input.poblacio ?? null,
      input.cp ?? null,
      input.superficie ?? null,
      input.habitacions ?? null,
      input.banys ?? null,
      input.ascensor,
      input.certEnergetic ?? null,
      input.notes ?? null,
    ]
  );
  const propietat = rows[0];

  if (input.titulars && input.titulars.length > 0) {
    await substituirTitulars(client, propietat.id, input.titulars);
  }

  return propietat;
}

export async function actualitzarPropietat(
  client: PoolClient,
  id: string,
  input: ActualitzarPropietat
): Promise<Propietat | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (input.referencia !== undefined) push('referencia', input.referencia);
  if (input.tipus !== undefined) push('tipus', input.tipus);
  if (input.adreca !== undefined) push('adreca', input.adreca);
  if (input.poblacio !== undefined) push('poblacio', input.poblacio);
  if (input.cp !== undefined) push('cp', input.cp);
  if (input.superficie !== undefined) push('superficie', input.superficie);
  if (input.habitacions !== undefined) push('habitacions', input.habitacions);
  if (input.banys !== undefined) push('banys', input.banys);
  if (input.ascensor !== undefined) push('ascensor', input.ascensor);
  if (input.certEnergetic !== undefined) push('cert_energetic', input.certEnergetic);
  if (input.notes !== undefined) push('notes', input.notes);

  let propietat: Propietat | null;
  if (sets.length > 0) {
    values.push(id);
    const { rows } = await client.query<Propietat>(
      `UPDATE propietats SET ${sets.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING ${PROPIETAT_COLUMNS}`,
      values
    );
    propietat = rows[0] ?? null;
  } else {
    propietat = await obtenirPropietat(client, id);
  }

  if (propietat && input.titulars !== undefined) {
    await substituirTitulars(client, id, input.titulars);
  }

  return propietat;
}

export async function donarBaixaPropietat(client: PoolClient, id: string): Promise<boolean> {
  const { rowCount } = await client.query(
    'UPDATE propietats SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return (rowCount ?? 0) > 0;
}

// --- Unitats ---

export interface Unitat {
  id: string;
  propietatId: string;
  referencia: string;
  planta: string | null;
  porta: string | null;
  superficie: string | null;
  rendaBase: string | null;
  estat: string;
  createdAt: string;
  updatedAt: string;
}

const UNITAT_COLUMNS = `
  id, propietat_id AS "propietatId", referencia, planta, porta, superficie,
  renda_base AS "rendaBase", estat, created_at AS "createdAt", updated_at AS "updatedAt"
`;

export async function llistarUnitats(client: PoolClient, propietatId: string): Promise<Unitat[]> {
  const { rows } = await client.query<Unitat>(
    `SELECT ${UNITAT_COLUMNS} FROM unitats WHERE propietat_id = $1 AND deleted_at IS NULL ORDER BY referencia ASC`,
    [propietatId]
  );
  return rows;
}

export async function obtenirUnitat(client: PoolClient, id: string, propietatId?: string): Promise<Unitat | null> {
  const conditions = ['id = $1', 'deleted_at IS NULL'];
  const values: unknown[] = [id];
  if (propietatId) {
    values.push(propietatId);
    conditions.push(`propietat_id = $${values.length}`);
  }
  const { rows } = await client.query<Unitat>(
    `SELECT ${UNITAT_COLUMNS} FROM unitats WHERE ${conditions.join(' AND ')}`,
    values
  );
  return rows[0] ?? null;
}

export async function crearUnitat(client: PoolClient, propietatId: string, input: CrearUnitat): Promise<Unitat> {
  const { rows } = await client.query<Unitat>(
    `INSERT INTO unitats (propietat_id, referencia, planta, porta, superficie, renda_base)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${UNITAT_COLUMNS}`,
    [propietatId, input.referencia, input.planta ?? null, input.porta ?? null, input.superficie ?? null, input.rendaBase ?? null]
  );
  return rows[0];
}

export async function actualitzarUnitat(
  client: PoolClient,
  id: string,
  propietatId: string,
  input: ActualitzarUnitat
): Promise<Unitat | null> {
  // Regla de negoci (docs/requirements.md 3.2): l'estat "ocupada" es deriva del
  // contracte actiu i no és editable manualment mentre n'hi hagi un de viu. Depèn d'una
  // altra taula, no es pot expressar amb un CHECK — es valida aquí (AGENT_API.md §8).
  if (input.estat !== undefined) {
    const { rows } = await client.query<{ existeix: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM contractes WHERE unitat_id = $1 AND estat = 'actiu') AS existeix",
      [id]
    );
    if (rows[0]?.existeix) {
      throw new BusinessRuleError("No es pot canviar manualment l'estat d'una unitat amb un contracte actiu.");
    }
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (input.referencia !== undefined) push('referencia', input.referencia);
  if (input.planta !== undefined) push('planta', input.planta);
  if (input.porta !== undefined) push('porta', input.porta);
  if (input.superficie !== undefined) push('superficie', input.superficie);
  if (input.rendaBase !== undefined) push('renda_base', input.rendaBase);
  if (input.estat !== undefined) push('estat', input.estat);

  if (sets.length === 0) {
    return obtenirUnitat(client, id, propietatId);
  }

  values.push(id, propietatId);
  const { rows } = await client.query<Unitat>(
    `UPDATE unitats SET ${sets.join(', ')}
      WHERE id = $${values.length - 1} AND propietat_id = $${values.length} AND deleted_at IS NULL
      RETURNING ${UNITAT_COLUMNS}`,
    values
  );
  return rows[0] ?? null;
}

export async function donarBaixaUnitat(client: PoolClient, id: string, propietatId: string): Promise<boolean> {
  const { rowCount } = await client.query(
    'UPDATE unitats SET deleted_at = now() WHERE id = $1 AND propietat_id = $2 AND deleted_at IS NULL',
    [id, propietatId]
  );
  return (rowCount ?? 0) > 0;
}
