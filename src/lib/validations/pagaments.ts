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

export const llistarPagamentsQuerySchema = paginationQuerySchema.extend({
  estat: estatPagamentEnum.optional(),
  contracteId: uuidSchema.optional(),
  remesaId: uuidSchema.optional(),
});
export type LlistarPagamentsQuery = z.infer<typeof llistarPagamentsQuerySchema>;
