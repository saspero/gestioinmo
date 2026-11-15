import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  formatValor,
  informeACsv,
  periodePerDefecte,
  type ResultatInforme,
} from '@/lib/validations/informes';
import { informeAPdf } from '@/app/api/_lib/pdf-informe';

const resultat: ResultatInforme = {
  columnes: [
    { id: 'propietat', label: 'Propietat', tipus: 'text' },
    { id: 'import', label: 'Import', tipus: 'import', total: true },
  ],
  files: [
    { propietat: 'Plaça Major; 1', import: 1234.5 },
    { propietat: 'Carrer "Nou"', import: 10 },
  ],
  totals: { import: 1244.5 },
};

describe('informes', () => {
  it('dona el període per defecte segons el tipus d\'informe', () => {
    expect(periodePerDefecte('passat', '2026-11-15')).toEqual({ dataInici: '2026-01-01', dataFi: '2026-12-31' });
    expect(periodePerDefecte('futur', '2026-11-15')).toEqual({ dataInici: '2026-11-15', dataFi: '2027-05-14' });
    expect(periodePerDefecte('cap', '2026-11-15')).toBeNull();
  });

  it('formata imports, percentatges i buits', () => {
    expect(formatValor(1234.5, 'import')).toMatch(/^1\.?234,50 €$/);
    expect(formatValor(2.5, 'percentatge')).toBe('2,5 %');
    expect(formatValor(null, 'import')).toBe('');
    expect(formatValor('2026-01-01', 'data')).toBe('2026-01-01');
  });

  it('fa un CSV per a Excel amb punt i coma, coma decimal i totals', () => {
    const csv = informeACsv(resultat);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Propietat;Import',
      '"Plaça Major; 1";1234,5',
      '"Carrer ""Nou""";10',
      'Total;1244,5',
    ]);
  });

  it('genera un PDF de diverses pàgines amb accents', async () => {
    const moltes: ResultatInforme = {
      ...resultat,
      files: Array.from({ length: 120 }, (_, i) => ({ propietat: `Àtic ${i} · Passeig de l'Estació −`, import: i })),
    };
    const bytes = await informeAPdf('Ingressos per propietat', 'Del 2026-01-01 al 2026-12-31', moltes);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getTitle()).toBe('Ingressos per propietat');
  });
});
