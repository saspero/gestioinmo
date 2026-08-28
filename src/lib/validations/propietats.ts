import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';

export const tipusPropietatEnum = z.enum(['edifici', 'casa', 'pis', 'local', 'solar', 'altres']);
export const estatUnitatEnum = z.enum(['vacant', 'ocupat', 'reservat', 'manteniment', 'baixa']);

// Copropietat (docs/requirements.md 3.3): el % de titularitat s'acaba validant a BD
// (trigger diferit `trg_check_percentatge_titularitat`, docs/db-schema.md §3.7) — aquí
// només es valida el format de cada fila.
export const titularSchema = z.object({
  personaId: uuidSchema,
  percentatge: z.number().gt(0).lte(100),
});

export const crearPropietatSchema = z.object({
  referencia: z.string().trim().min(1, 'La referència és obligatòria'),
  tipus: tipusPropietatEnum.default('pis'),
  adreca: z.string().trim().min(1, "L'adreça és obligatòria"),
  poblacio: z.string().trim().optional(),
  cp: z.string().trim().optional(),
  superficie: z.number().positive().optional(),
  habitacions: z.number().int().nonnegative().optional(),
  banys: z.number().int().nonnegative().optional(),
  ascensor: z.boolean().default(false),
  certEnergetic: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  titulars: z.array(titularSchema).optional(),
});
export type CrearPropietat = z.infer<typeof crearPropietatSchema>;

export const actualitzarPropietatSchema = crearPropietatSchema.partial();
export type ActualitzarPropietat = z.infer<typeof actualitzarPropietatSchema>;

export const llistarPropietatsQuerySchema = paginationQuerySchema.extend({
  tipus: tipusPropietatEnum.optional(),
  poblacio: z.string().trim().optional(),
  q: z.string().trim().optional(),
});
export type LlistarPropietatsQuery = z.infer<typeof llistarPropietatsQuerySchema>;

export const crearUnitatSchema = z.object({
  referencia: z.string().trim().min(1, 'La referència és obligatòria'),
  planta: z.string().trim().optional(),
  porta: z.string().trim().optional(),
  superficie: z.number().positive().optional(),
  rendaBase: z.number().nonnegative().optional(),
});
export type CrearUnitat = z.infer<typeof crearUnitatSchema>;

export const actualitzarUnitatSchema = crearUnitatSchema.partial().extend({
  estat: estatUnitatEnum.optional(),
});
export type ActualitzarUnitat = z.infer<typeof actualitzarUnitatSchema>;
