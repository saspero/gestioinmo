import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';

export const prioritatIncidenciaEnum = z.enum(['baixa', 'normal', 'alta', 'urgent']);
export const estatIncidenciaEnum = z.enum(['oberta', 'assignada', 'en_curs', 'resolta']);

export const crearIncidenciaSchema = z.object({
  unitatId: uuidSchema,
  contracteId: uuidSchema.optional(),
  reportadorId: uuidSchema.optional(),
  titol: z.string().trim().min(1, 'El títol és obligatori'),
  descripcio: z.string().trim().optional(),
  prioritat: prioritatIncidenciaEnum.default('normal'),
});
export type CrearIncidencia = z.infer<typeof crearIncidenciaSchema>;

// L'estat 'resolta' només s'assoleix via POST /resoldre (docs/requirements.md, regla
// #6: no es pot reobrir un cop resolta — el trigger `trg_prevent_reobrir_incidencia`
// ho garanteix a BD, però el PATCH genèric ja no ofereix aquest valor com a opció).
export const actualitzarIncidenciaSchema = z.object({
  titol: z.string().trim().min(1).optional(),
  descripcio: z.string().trim().optional(),
  prioritat: prioritatIncidenciaEnum.optional(),
  estat: z.enum(['oberta', 'assignada', 'en_curs']).optional(),
  assignatA: uuidSchema.optional(),
  costEstimat: z.number().nonnegative().optional(),
  costFinal: z.number().nonnegative().optional(),
});
export type ActualitzarIncidencia = z.infer<typeof actualitzarIncidenciaSchema>;

export const resoldreIncidenciaSchema = z.object({
  costFinal: z.number().nonnegative().optional(),
});
export type ResoldreIncidencia = z.infer<typeof resoldreIncidenciaSchema>;

export const crearComentariSchema = z.object({
  text: z.string().trim().min(1, 'El comentari no pot ser buit'),
});
export type CrearComentari = z.infer<typeof crearComentariSchema>;

export const llistarIncidenciesQuerySchema = paginationQuerySchema.extend({
  estat: estatIncidenciaEnum.optional(),
  prioritat: prioritatIncidenciaEnum.optional(),
  unitatId: uuidSchema.optional(),
  assignatA: uuidSchema.optional(),
});
export type LlistarIncidenciesQuery = z.infer<typeof llistarIncidenciesQuerySchema>;
