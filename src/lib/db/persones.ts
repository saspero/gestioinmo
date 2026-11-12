// Xifratge de camps sensibles (docs/db-schema.md §7.1): `nif`/`iban`/`email` es
// desxifren/xifren amb `pgp_sym_decrypt`/`pgp_sym_encrypt` (pgcrypto), passant
// `DB_ENCRYPTION_KEY` com a paràmetre preparat — mai amb `SET`/`SET LOCAL` (quedaria
// als logs de sessió) ni interpolat a la sentència. Totes les queries reserven `$1`
// per a la clau perquè els SELECT amb columnes desxifrades siguin consistents.

import type { PoolClient } from 'pg';
import { BusinessRuleError } from './business-error';
import { buildLimitOffsetClause, buildOrderByClause, buildMeta } from './pagination';
import type { LlistarPersonesQuery, ActualitzarPersona } from '../validations/persones';

export type TipusPersona = 'propietari' | 'inquili' | 'empresa';

export interface Persona {
  id: string;
  tipus: TipusPersona;
  nom: string;
  cognoms: string | null;
  nif: string | null;
  email: string | null;
  telefon: string | null;
  iban: string | null;
  adreca: string | null;
  notes: string | null;
  estatInquili: string | null;
  personaJuridica: boolean;
  representantNom: string | null;
  representantNif: string | null;
  representantCarrec: string | null;
  createdAt: string;
  updatedAt: string;
}

function getEncryptionKey(): string {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('DB_ENCRYPTION_KEY no configurada.');
  }
  return key;
}

const PERSONA_COLUMNS = `
  id, tipus, nom, cognoms,
  pgp_sym_decrypt(nif_enc, $1) AS nif,
  pgp_sym_decrypt(email_enc, $1) AS email,
  telefon,
  pgp_sym_decrypt(iban_enc, $1) AS iban,
  adreca, notes, estat_inquili AS "estatInquili",
  persona_juridica AS "personaJuridica",
  representant_nom AS "representantNom",
  pgp_sym_decrypt(representant_nif_enc, $1) AS "representantNif",
  representant_carrec AS "representantCarrec",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const PERSONES_SORT_COLUMNS = ['nom', 'cognoms', 'created_at'] as const;

export async function llistarPersones(
  client: PoolClient,
  tipus: TipusPersona,
  query: LlistarPersonesQuery
): Promise<{ data: Persona[]; meta: { page: number; pageSize: number; total: number } }> {
  const key = getEncryptionKey();
  const conditions: string[] = ['deleted_at IS NULL', 'tipus = $2'];
  const values: unknown[] = [key, tipus];

  if (query.q) {
    values.push(`%${query.q}%`);
    conditions.push(`(nom ILIKE $${values.length} OR cognoms ILIKE $${values.length})`);
  }
  if (query.estatInquili) {
    values.push(query.estatInquili);
    conditions.push(`estat_inquili = $${values.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const orderBy = buildOrderByClause(query, PERSONES_SORT_COLUMNS, 'nom');
  const { clause: limitOffset, values: limitOffsetValues } = buildLimitOffsetClause(query, values.length + 1);

  const { rows } = await client.query<Persona>(
    `SELECT ${PERSONA_COLUMNS} FROM persones ${where} ${orderBy} ${limitOffset}`,
    [...values, ...limitOffsetValues]
  );
  // El recompte no desxifra res, però `where` numera els filtres a partir de `$2`:
  // `$1` s'ha de declarar igualment i va a NULL perquè la clau no viatgi sense necessitat.
  const { rows: countRows } = await client.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM persones ${where} AND $1::text IS NULL`,
    [null, ...values.slice(1)]
  );

  return { data: rows, meta: buildMeta(query, Number(countRows[0]?.total ?? 0)) };
}

export async function obtenirPersona(client: PoolClient, id: string, tipus: TipusPersona): Promise<Persona | null> {
  const key = getEncryptionKey();
  const { rows } = await client.query<Persona>(
    `SELECT ${PERSONA_COLUMNS} FROM persones WHERE id = $2 AND tipus = $3 AND deleted_at IS NULL`,
    [key, id, tipus]
  );
  return rows[0] ?? null;
}

interface CrearPersonaInput {
  personaJuridica?: boolean;
  representantNom?: string;
  representantNif?: string;
  representantCarrec?: string;
  nom: string;
  cognoms?: string;
  nif?: string;
  email?: string;
  telefon?: string;
  iban?: string;
  adreca?: string;
  notes?: string;
}

export async function crearPersona(client: PoolClient, tipus: TipusPersona, input: CrearPersonaInput): Promise<Persona> {
  const key = getEncryptionKey();
  // Física: sense representant. Jurídica: sense cognoms (constraint persones_juridica_coherent).
  const juridica = input.personaJuridica ?? false;
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO persones (tipus, nom, cognoms, nif_enc, nif_hash, email_enc, telefon, iban_enc, adreca, notes,
                           persona_juridica, representant_nom, representant_nif_enc, representant_carrec)
     VALUES (
       $1, $2, $3,
       CASE WHEN $4::text IS NULL THEN NULL ELSE pgp_sym_encrypt($4, $9) END,
       CASE WHEN $4::text IS NULL THEN NULL ELSE encode(hmac($4, $9, 'sha256'), 'hex') END,
       CASE WHEN $5::text IS NULL THEN NULL ELSE pgp_sym_encrypt($5, $9) END,
       $6,
       CASE WHEN $7::text IS NULL THEN NULL ELSE pgp_sym_encrypt($7, $9) END,
       $8, $10,
       $11, $12,
       CASE WHEN $13::text IS NULL THEN NULL ELSE pgp_sym_encrypt($13, $9) END,
       $14
     )
     RETURNING id`,
    [
      tipus,
      input.nom,
      juridica ? null : (input.cognoms ?? null),
      input.nif ?? null,
      input.email ?? null,
      input.telefon ?? null,
      input.iban ?? null,
      input.adreca ?? null,
      key,
      input.notes ?? null,
      juridica,
      juridica ? (input.representantNom ?? null) : null,
      juridica ? (input.representantNif ?? null) : null,
      juridica ? (input.representantCarrec ?? null) : null,
    ]
  );

  const persona = await obtenirPersona(client, rows[0].id, tipus);
  if (!persona) {
    throw new Error("No s'ha pogut recuperar la persona acabada de crear.");
  }
  return persona;
}

export async function actualitzarPersona(
  client: PoolClient,
  id: string,
  tipus: TipusPersona,
  input: ActualitzarPersona
): Promise<Persona | null> {
  const key = getEncryptionKey();
  const sets: string[] = [];
  const values: unknown[] = [key];

  const push = (column: string, value: unknown): void => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  const pushEncrypted = (column: string, hashColumn: string | null, value: string | null | undefined): void => {
    if (value === undefined) return;
    values.push(value);
    const idx = values.length;
    sets.push(`${column} = CASE WHEN $${idx}::text IS NULL THEN NULL ELSE pgp_sym_encrypt($${idx}, $1) END`);
    if (hashColumn) {
      sets.push(
        `${hashColumn} = CASE WHEN $${idx}::text IS NULL THEN NULL ELSE encode(hmac($${idx}, $1, 'sha256'), 'hex') END`
      );
    }
  };

  // Canviar de física a jurídica (o al revés) buida els camps que deixen de tenir sentit.
  // Els camps que el canvi buida no es poden assignar a la mateixa sentència.
  const juridica = input.personaJuridica;
  if (juridica !== undefined) {
    push('persona_juridica', juridica);
    if (juridica) {
      sets.push('cognoms = NULL');
    } else {
      sets.push('representant_nom = NULL', 'representant_nif_enc = NULL', 'representant_carrec = NULL');
    }
  }
  if (juridica !== false) {
    if (input.representantNom !== undefined) push('representant_nom', input.representantNom);
    if (input.representantCarrec !== undefined) push('representant_carrec', input.representantCarrec);
    pushEncrypted('representant_nif_enc', null, input.representantNif);
  }

  if (input.nom !== undefined) push('nom', input.nom);
  if (input.cognoms !== undefined && juridica !== true) push('cognoms', input.cognoms);
  if (input.telefon !== undefined) push('telefon', input.telefon);
  if (input.adreca !== undefined) push('adreca', input.adreca);
  if (input.notes !== undefined) push('notes', input.notes);
  pushEncrypted('nif_enc', 'nif_hash', input.nif);
  pushEncrypted('email_enc', null, input.email);
  pushEncrypted('iban_enc', null, input.iban);

  if (sets.length === 0) {
    return obtenirPersona(client, id, tipus);
  }

  values.push(id, tipus);
  // `$1::text` tipa la clau quan només s'actualitzen camps no xifrats i ningú més la usa.
  await client.query(
    `UPDATE persones SET ${sets.join(', ')}
      WHERE id = $${values.length - 1} AND tipus = $${values.length} AND deleted_at IS NULL AND $1::text IS NOT NULL`,
    values
  );
  return obtenirPersona(client, id, tipus);
}

export async function donarBaixaPersona(client: PoolClient, id: string, tipus: TipusPersona): Promise<boolean> {
  if (tipus === 'propietari') {
    const { rows } = await client.query(
      `SELECT 1
         FROM propietat_propietaris pp
         JOIN propietats p ON p.id = pp.propietat_id
        WHERE pp.persona_id = $1 AND p.deleted_at IS NULL
        LIMIT 1`,
      [id]
    );
    if (rows.length > 0) {
      throw new BusinessRuleError(
        'No es pot donar de baixa aquest propietari: encara té propietats associades. Elimina primer la seva titularitat o transfereix-la.'
      );
    }
  }

  const { rowCount } = await client.query(
    'UPDATE persones SET deleted_at = now() WHERE id = $1 AND tipus = $2 AND deleted_at IS NULL',
    [id, tipus]
  );
  return (rowCount ?? 0) > 0;
}
