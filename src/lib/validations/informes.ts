import { z } from 'zod';
import { uuidSchema, dateStringSchema } from './common';
import { sumarDies, sumarMesos } from './contractes';

export const dashboardQuerySchema = z.object({
  dataInici: dateStringSchema.optional(),
  dataFi: dateStringSchema.optional(),
  propietatId: uuidSchema.optional(),
  propietariId: uuidSchema.optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const recursExportEnum = z.enum(['propietats', 'propietaris', 'inquilins', 'contractes', 'pagaments', 'incidencies']);
export type RecursExport = z.infer<typeof recursExportEnum>;

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'pdf']),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;

// --- Pestanya Informes ---

export const informeIdEnum = z.enum([
  'ingressos',
  'rendiment',
  'liquidacions',
  'morositat',
  'venciments',
  'actualitzacions',
  'ocupacio',
  'incidencies',
]);
export type InformeId = z.infer<typeof informeIdEnum>;

export type TipusColumna = 'text' | 'import' | 'data' | 'numero' | 'percentatge';

export interface ColumnaInforme {
  id: string;
  label: string;
  tipus: TipusColumna;
  /** Suma la columna a la fila de totals. */
  total?: boolean;
}

export type ValorInforme = string | number | null;

export interface ResultatInforme {
  columnes: ColumnaInforme[];
  files: Record<string, ValorInforme>[];
  totals: Record<string, number> | null;
}

/**
 * Com es filtra per dates: `passat` (per defecte l'any en curs), `futur` (per defecte
 * d'avui a 6 mesos) o `cap` (l'informe és una foto d'avui).
 */
export type PeriodeInforme = 'passat' | 'futur' | 'cap';

export interface DefinicioInforme {
  id: InformeId;
  titol: string;
  descripcio: string;
  grup: 'Econòmics' | 'Gestió';
  periode: PeriodeInforme;
}

export const INFORMES: readonly DefinicioInforme[] = [
  {
    id: 'ingressos',
    titol: 'Ingressos per propietat',
    descripcio: 'Rebuts emesos, cobrats i pendents de cada propietat, mes a mes (per data de venciment).',
    grup: 'Econòmics',
    periode: 'passat',
  },
  {
    id: 'rendiment',
    titol: 'Rendiment per propietat',
    descripcio: 'Cobrat menys despeses de cada propietat en el període.',
    grup: 'Econòmics',
    periode: 'passat',
  },
  {
    id: 'liquidacions',
    titol: 'Resum de liquidacions',
    descripcio: 'Liquidacions als propietaris: cobrat, despeses, comissió, IVA i net.',
    grup: 'Econòmics',
    periode: 'passat',
  },
  {
    id: 'morositat',
    titol: 'Morositat',
    descripcio: 'Rebuts vençuts o en mora a dia d\'avui, amb els dies de retard.',
    grup: 'Econòmics',
    periode: 'cap',
  },
  {
    id: 'venciments',
    titol: 'Venciments de contractes',
    descripcio: 'Contractes que acaben o es prorroguen en el període, amb el límit per comunicar la no renovació.',
    grup: 'Gestió',
    periode: 'futur',
  },
  {
    id: 'actualitzacions',
    titol: 'Actualitzacions de renda',
    descripcio: 'Aniversaris dels contractes en el període i si la renda ja s\'ha actualitzat.',
    grup: 'Gestió',
    periode: 'passat',
  },
  {
    id: 'ocupacio',
    titol: 'Ocupació',
    descripcio: 'Unitats llogades i vacants a dia d\'avui, i des de quan estan buides.',
    grup: 'Gestió',
    periode: 'cap',
  },
  {
    id: 'incidencies',
    titol: 'Incidències',
    descripcio: 'Incidències obertes per antiguitat i les resoltes en el període, amb el cost.',
    grup: 'Gestió',
    periode: 'passat',
  },
];

export function definicioInforme(id: InformeId): DefinicioInforme {
  return INFORMES.find((informe) => informe.id === id)!;
}

/** Període per defecte d'un informe, a partir de la data d'avui (YYYY-MM-DD). */
export function periodePerDefecte(periode: PeriodeInforme, avui: string): { dataInici: string; dataFi: string } | null {
  if (periode === 'cap') return null;
  if (periode === 'passat') return { dataInici: `${avui.slice(0, 4)}-01-01`, dataFi: `${avui.slice(0, 4)}-12-31` };
  return { dataInici: avui, dataFi: sumarDies(sumarMesos(avui, 6), -1) };
}

export const informeQuerySchema = z.object({
  dataInici: dateStringSchema.optional(),
  dataFi: dateStringSchema.optional(),
  propietatId: uuidSchema.optional(),
  propietariId: uuidSchema.optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
});
export type InformeQuery = z.infer<typeof informeQuerySchema>;

export interface FiltresInforme {
  dataInici: string;
  dataFi: string;
  propietatId?: string;
  propietariId?: string;
}

/** Valor d'una cel·la tal com es mostra (pantalla i PDF). */
export function formatValor(valor: ValorInforme | undefined, tipus: TipusColumna): string {
  if (valor === null || valor === undefined || valor === '') return '';
  if (typeof valor === 'number') {
    if (tipus === 'import') {
      return `${valor.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    }
    if (tipus === 'percentatge') return `${valor.toLocaleString('ca-ES', { maximumFractionDigits: 2 })} %`;
    return valor.toLocaleString('ca-ES');
  }
  return valor;
}

/**
 * CSV per obrir amb Excel en català o castellà: punt i coma com a separador, coma decimal
 * i BOM perquè reconegui l'UTF-8.
 */
export function informeACsv(resultat: ResultatInforme): string {
  const cella = (text: string) => (/[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
  const valorCsv = (valor: ValorInforme | undefined) =>
    typeof valor === 'number' ? String(valor).replace('.', ',') : (valor ?? '');
  const linies = [resultat.columnes.map((c) => cella(c.label)).join(';')];
  for (const fila of resultat.files) {
    linies.push(resultat.columnes.map((c) => cella(valorCsv(fila[c.id]))).join(';'));
  }
  if (resultat.totals) {
    linies.push(
      resultat.columnes
        .map((c, index) => (index === 0 ? 'Total' : c.id in resultat.totals! ? valorCsv(resultat.totals![c.id]) : ''))
        .map(cella)
        .join(';')
    );
  }
  return `﻿${linies.join('\r\n')}`;
}
