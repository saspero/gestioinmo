import { describe, expect, it } from 'vitest';
import {
  crearDocumentSchema,
  MIDA_MAXIMA_DOCUMENT,
  MIDA_PART_DOCUMENT,
  midaPartDocument,
  nombrePartsDocument,
  potGestionarDocuments,
  tipusDocument,
} from '@/lib/validations/documents';

const UUID = '7d1c2a50-5d6b-4b8e-9b1a-1f0e2d3c4b5a';

describe('documents', () => {
  it('reconeix el tipus pel navegador o per l\'extensió, i rebutja la resta', () => {
    expect(tipusDocument('dni.pdf', 'application/pdf')).toBe('application/pdf');
    expect(tipusDocument('foto.HEIC', '')).toBe('image/heic');
    expect(tipusDocument('contracte.docx', 'application/octet-stream')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(tipusDocument('pagina.html', 'text/html')).toBeUndefined();
    expect(tipusDocument('logo.svg', 'image/svg+xml')).toBeUndefined();
  });

  it('parteix el fitxer en trossos que sumen la mida exacta', () => {
    const mida = MIDA_PART_DOCUMENT * 2 + 10;
    expect(nombrePartsDocument(mida)).toBe(3);
    expect([0, 1, 2].map((idx) => midaPartDocument(mida, idx))).toEqual([MIDA_PART_DOCUMENT, MIDA_PART_DOCUMENT, 10]);
    expect(midaPartDocument(mida, 3)).toBe(0);
    expect(nombrePartsDocument(MIDA_PART_DOCUMENT)).toBe(1);
    expect(midaPartDocument(MIDA_PART_DOCUMENT, 0)).toBe(MIDA_PART_DOCUMENT);
  });

  it('limita la mida a 10 MB i només accepta els tipus admesos', () => {
    const base = { entitat: 'propietat', entitatId: UUID, nom: 'a.pdf', mime: 'application/pdf' };
    expect(crearDocumentSchema.safeParse({ ...base, mida: MIDA_MAXIMA_DOCUMENT }).success).toBe(true);
    expect(crearDocumentSchema.safeParse({ ...base, mida: MIDA_MAXIMA_DOCUMENT + 1 }).success).toBe(false);
    expect(crearDocumentSchema.safeParse({ ...base, mida: 0 }).success).toBe(false);
    expect(crearDocumentSchema.safeParse({ ...base, mida: 10, mime: 'text/html' }).success).toBe(false);
  });

  it('segueix els permisos de la fitxa on està adjuntat', () => {
    expect(potGestionarDocuments('gestor', 'persona', 'escriptura')).toBe(true);
    expect(potGestionarDocuments('comptable', 'persona', 'lectura')).toBe(true);
    expect(potGestionarDocuments('comptable', 'contracte', 'escriptura')).toBe(false);
    expect(potGestionarDocuments('comptable', 'incidencia', 'escriptura')).toBe(false);
  });
});
