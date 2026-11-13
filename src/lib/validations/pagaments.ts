import { z } from 'zod';
import { paginationQuerySchema, uuidSchema, dateStringSchema } from './common';

export const metodePagamentEnum = z.enum(['domiciliacio', 'transferencia', 'efectiu', 'targeta', 'altres']);
export const estatPagamentEnum = z.enum(['pendent', 'remesa', 'cobrat', 'vencut', 'mora', 'regularitzat']);

export const crearPagamentSchema = z.object({
  contracteId: uuidSchema,
  concepte: z.string().trim().min(1).default('Lloguer'),
  import: z.number().positive(),
  dataVenciment: dateStringSchema,
});
export type CrearPagament = z.infer<typeof crearPagamentSchema>;

export const actualitzarPagamentSchema = z.object({
  concepte: z.string().trim().min(1).optional(),
  dataVenciment: dateStringSchema.optional(),
});
export type ActualitzarPagament = z.infer<typeof actualitzarPagamentSchema>;

export const cobrarPagamentSchema = z.object({
  dataCobrament: dateStringSchema,
  metode: metodePagamentEnum,
});
export type CobrarPagament = z.infer<typeof cobrarPagamentSchema>;

export const crearRemesaSchema = z.object({
  referencia: z.string().trim().min(1, 'La referència és obligatòria'),
  pagamentsIds: z.array(uuidSchema).min(1, 'Cal indicar almenys un rebut'),
  dataEnviament: dateStringSchema.optional(),
});
export type CrearRemesa = z.infer<typeof crearRemesaSchema>;

const MESOS_REBUT = [
  'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre',
] as const;

/** Mes dels rebuts generats, en format YYYY-MM. */
export const generarRebutsSchema = z.object({
  periode: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes no vàlid (format YYYY-MM)'),
});
export type GenerarRebuts = z.infer<typeof generarRebutsSchema>;

/** "Lloguer de novembre de 2026", "Lloguer d'abril de 2026". */
export function concepteRebut(periode: string): string {
  const [any, mes] = periode.split('-').map(Number);
  const nom = MESOS_REBUT[mes - 1];
  const de = /^[aeiou]/.test(nom) ? "d'" : 'de ';
  return `Lloguer ${de}${nom} de ${any}`;
}

export const llistarPagamentsQuerySchema = paginationQuerySchema.extend({
  estat: estatPagamentEnum.optional(),
  contracteId: uuidSchema.optional(),
  remesaId: uuidSchema.optional(),
});
export type LlistarPagamentsQuery = z.infer<typeof llistarPagamentsQuerySchema>;
