import { z } from 'zod';
import { paginationQuerySchema, uuidSchema, dateStringSchema } from './common';

export const categoriaDespesaEnum = z.enum([
  'manteniment',
  'subministraments',
  'assegurances',
  'impostos',
  'comunitat',
  'gestoria',
  'altres',
]);

export const crearDespesaSchema = z.object({
  propietatId: uuidSchema,
  unitatId: uuidSchema.optional(),
  incidenciaId: uuidSchema.optional(),
  categoria: categoriaDespesaEnum.default('altres'),
  concepte: z.string().trim().min(1, 'El concepte és obligatori'),
  import: z.number().positive(),
  dataDespesa: dateStringSchema,
  proveidor: z.string().trim().optional(),
  facturaUrl: z.string().trim().optional(),
  repercutiblePropietari: z.boolean().default(true),
  notes: z.string().trim().optional(),
});
export type CrearDespesa = z.infer<typeof crearDespesaSchema>;

// propietatId no s'admet a l'actualització: és l'ancoratge de la despesa (com unitatId a
// actualitzarIncidenciaSchema), no es reassigna un cop creada.
export const actualitzarDespesaSchema = z.object({
  unitatId: uuidSchema.optional(),
  incidenciaId: uuidSchema.optional(),
  categoria: categoriaDespesaEnum.optional(),
  concepte: z.string().trim().min(1).optional(),
  import: z.number().positive().optional(),
  dataDespesa: dateStringSchema.optional(),
  proveidor: z.string().trim().optional(),
  facturaUrl: z.string().trim().optional(),
  repercutiblePropietari: z.boolean().optional(),
  notes: z.string().trim().optional(),
});
export type ActualitzarDespesa = z.infer<typeof actualitzarDespesaSchema>;

export const llistarDespesesQuerySchema = paginationQuerySchema.extend({
  propietatId: uuidSchema.optional(),
  unitatId: uuidSchema.optional(),
  incidenciaId: uuidSchema.optional(),
  categoria: categoriaDespesaEnum.optional(),
  dataInici: dateStringSchema.optional(),
  dataFi: dateStringSchema.optional(),
});
export type LlistarDespesesQuery = z.infer<typeof llistarDespesesQuerySchema>;
