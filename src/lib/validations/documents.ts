import { z } from 'zod';
import type { Accio, Modul, RolUsuari } from '../auth/rbac';
import { can } from '../auth/rbac';
import { uuidSchema } from './common';

export const MIDA_MAXIMA_DOCUMENT = 10 * 1024 * 1024;

/**
 * Els fitxers viatgen i es guarden en trossos d'aquesta mida: una funció de Vercel no
 * accepta ni retorna més de 4,5 MB per petició.
 */
export const MIDA_PART_DOCUMENT = 3 * 1024 * 1024;

export const entitatDocumentEnum = z.enum(['propietat', 'persona', 'contracte', 'incidencia']);
export type EntitatDocument = z.infer<typeof entitatDocumentEnum>;

/**
 * Tipus de fitxer acceptats, amb les extensions que els identifiquen quan el navegador
 * no en dona el tipus. No s'hi admet res que el navegador pugui executar (HTML, SVG...).
 */
export const TIPUS_DOCUMENT_PERMESOS: Record<string, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/heic': ['heic'],
  'image/heif': ['heif'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.oasis.opendocument.text': ['odt'],
  'application/vnd.oasis.opendocument.spreadsheet': ['ods'],
  'text/plain': ['txt'],
};

/** Tipus del fitxer: el que diu el navegador si és acceptat; si no, el de l'extensió. */
export function tipusDocument(nom: string, tipusNavegador: string): string | undefined {
  if (tipusNavegador in TIPUS_DOCUMENT_PERMESOS) return tipusNavegador;
  const extensio = nom.split('.').pop()?.toLowerCase() ?? '';
  return Object.keys(TIPUS_DOCUMENT_PERMESOS).find((mime) => TIPUS_DOCUMENT_PERMESOS[mime].includes(extensio));
}

export const crearDocumentSchema = z.object({
  entitat: entitatDocumentEnum,
  entitatId: uuidSchema,
  nom: z.string().trim().min(1, 'El nom del fitxer és obligatori').max(255, 'El nom del fitxer és massa llarg'),
  mime: z
    .string()
    .refine((mime) => mime in TIPUS_DOCUMENT_PERMESOS, 'Tipus de fitxer no admès. Puja un PDF, una imatge o un document de text o full de càlcul.'),
  mida: z
    .number()
    .int()
    .positive('El fitxer és buit')
    .max(MIDA_MAXIMA_DOCUMENT, 'El fitxer no pot fer més de 10 MB'),
});
export type CrearDocument = z.infer<typeof crearDocumentSchema>;

export const llistarDocumentsQuerySchema = z.object({
  entitat: entitatDocumentEnum,
  entitatId: uuidSchema,
});

export function nombrePartsDocument(mida: number): number {
  return Math.ceil(mida / MIDA_PART_DOCUMENT);
}

/** Mida exacta que ha de tenir el tros `idx` d'un fitxer de `mida` bytes. */
export function midaPartDocument(mida: number, idx: number): number {
  const parts = nombrePartsDocument(mida);
  if (idx < 0 || idx >= parts) return 0;
  return idx < parts - 1 ? MIDA_PART_DOCUMENT : mida - MIDA_PART_DOCUMENT * (parts - 1);
}

// Un document segueix els permisos de la fitxa on està adjuntat. Propietaris i inquilins
// comparteixen la taula `persones`, així que en calen tots dos permisos.
const MODULS_PER_ENTITAT: Record<EntitatDocument, readonly Modul[]> = {
  propietat: ['propietats'],
  persona: ['propietaris', 'inquilins'],
  contracte: ['contractes'],
  incidencia: ['incidencies'],
};

export function potGestionarDocuments(rol: RolUsuari, entitat: EntitatDocument, accio: Accio): boolean {
  return MODULS_PER_ENTITAT[entitat].every((modul) => can(rol, modul, accio));
}
