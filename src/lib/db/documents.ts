// Documents adjunts (db/migrations/019_documents.sql). El contingut es guarda partit en
// trossos de `MIDA_PART_DOCUMENT` i xifrat amb `pgp_sym_encrypt_bytea`, amb la mateixa
// clau i el mateix criteri que els camps sensibles de `persones.ts`: la clau sempre va
// com a paràmetre preparat.

import type { PoolClient } from 'pg';
import { BusinessRuleError } from './business-error';
import { getEncryptionKey } from './persones';
import { nombrePartsDocument, type CrearDocument, type EntitatDocument } from '../validations/documents';

export interface Document {
  id: string;
  entitat: EntitatDocument;
  entitatId: string;
  nom: string;
  mime: string;
  mida: number;
  parts: number;
  pujatPer: string | null;
  createdAt: string;
}

/** Fitxa interna, amb l'estat de la pujada. */
export interface DocumentIntern extends Document {
  complet: boolean;
}

const DOCUMENT_COLUMNS = `
  d.id, d.entitat, d.entitat_id AS "entitatId", d.nom, d.mime, d.mida, d.parts, d.complet,
  d.created_at AS "createdAt",
  NULLIF(concat_ws(' ', tu.nom, tu.cognoms), '') AS "pujatPer"`;

const DOCUMENT_FROM = 'documents d LEFT JOIN public.tenant_users tu ON tu.id = d.pujat_per';

// Una consulta fixa per entitat: el nom de la taula mai surt de l'entrada de l'usuari.
const EXISTEIX_ENTITAT: Record<EntitatDocument, string> = {
  propietat: 'SELECT 1 FROM propietats WHERE id = $1 AND deleted_at IS NULL',
  persona: 'SELECT 1 FROM persones WHERE id = $1 AND deleted_at IS NULL',
  contracte: 'SELECT 1 FROM contractes WHERE id = $1 AND deleted_at IS NULL',
  incidencia: 'SELECT 1 FROM incidencies WHERE id = $1 AND deleted_at IS NULL',
};

export async function entitatExisteix(client: PoolClient, entitat: EntitatDocument, id: string): Promise<boolean> {
  const { rowCount } = await client.query(EXISTEIX_ENTITAT[entitat], [id]);
  return (rowCount ?? 0) > 0;
}

function sensePujada(document: DocumentIntern): Document {
  const { complet, ...resta } = document;
  void complet;
  return resta;
}

export async function llistarDocuments(
  client: PoolClient,
  entitat: EntitatDocument,
  entitatId: string
): Promise<Document[]> {
  const { rows } = await client.query<DocumentIntern>(
    `SELECT ${DOCUMENT_COLUMNS} FROM ${DOCUMENT_FROM}
      WHERE d.entitat = $1 AND d.entitat_id = $2 AND d.complet
      ORDER BY d.created_at DESC`,
    [entitat, entitatId]
  );
  return rows.map(sensePujada);
}

export async function obtenirDocument(client: PoolClient, id: string): Promise<DocumentIntern | null> {
  const { rows } = await client.query<DocumentIntern>(
    `SELECT ${DOCUMENT_COLUMNS} FROM ${DOCUMENT_FROM} WHERE d.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Registra un document nou, pendent de rebre'n els trossos. De passada esborra les
 * pujades que fa més d'un dia que van quedar a mitges.
 */
export async function crearDocument(client: PoolClient, input: CrearDocument, usuariId: string): Promise<Document> {
  await client.query("DELETE FROM documents WHERE NOT complet AND created_at < now() - interval '1 day'");
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO documents (entitat, entitat_id, nom, mime, mida, parts, pujat_per)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [input.entitat, input.entitatId, input.nom, input.mime, input.mida, nombrePartsDocument(input.mida), usuariId]
  );
  const document = await obtenirDocument(client, rows[0].id);
  if (!document) throw new Error("No s'ha pogut llegir el document acabat de crear.");
  return sensePujada(document);
}

/** Desa un tros. Tornar a enviar el mateix tros el substitueix (per poder reintentar). */
export async function desarPartDocument(client: PoolClient, id: string, idx: number, dades: Buffer): Promise<void> {
  await client.query(
    `INSERT INTO document_parts (document_id, idx, dades_enc)
     VALUES ($1, $2, pgp_sym_encrypt_bytea($3, $4))
     ON CONFLICT (document_id, idx) DO UPDATE SET dades_enc = EXCLUDED.dades_enc`,
    [id, idx, dades, getEncryptionKey()]
  );
}

/** Marca el document com a complet si n'han arribat tots els trossos. */
export async function completarDocument(client: PoolClient, id: string): Promise<Document> {
  const { rows } = await client.query<{ rebudes: number; parts: number }>(
    `SELECT d.parts, (SELECT count(*)::int FROM document_parts p WHERE p.document_id = d.id) AS rebudes
       FROM documents d WHERE d.id = $1 FOR UPDATE`,
    [id]
  );
  const estat = rows[0];
  if (!estat || estat.rebudes !== estat.parts) {
    throw new BusinessRuleError('Encara no ha arribat tot el fitxer. Torna a pujar-lo.');
  }
  await client.query('UPDATE documents SET complet = true WHERE id = $1', [id]);
  const document = await obtenirDocument(client, id);
  if (!document) throw new Error("No s'ha pogut llegir el document completat.");
  return sensePujada(document);
}

export async function llegirPartDocument(client: PoolClient, id: string, idx: number): Promise<Buffer | null> {
  const { rows } = await client.query<{ dades: Buffer }>(
    `SELECT pgp_sym_decrypt_bytea(dades_enc, $3) AS dades
       FROM document_parts WHERE document_id = $1 AND idx = $2`,
    [id, idx, getEncryptionKey()]
  );
  return rows[0]?.dades ?? null;
}

export async function esborrarDocument(client: PoolClient, id: string): Promise<boolean> {
  const { rowCount } = await client.query('DELETE FROM documents WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}
