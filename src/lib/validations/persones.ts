import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const tipusPersonaEnum = z.enum(['propietari', 'inquili', 'empresa']);
export const estatInquiliEnum = z.enum(['actiu', 'moros', 'inactiu']);

const nifSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{5,15}$/, 'NIF/CIF no vàlid');

// `personaJuridica` no porta valor per defecte: a `actualitzarPersonaSchema` (parcial),
// un default faria tornar a física qualsevol persona jurídica en editar-ne un altre camp.
// La BD hi posa `false` en crear.
const basePersonaSchema = z.object({
  personaJuridica: z.boolean().optional(),
  /** Nom de la persona física o raó social de la jurídica. */
  nom: z.string().trim().min(1, 'El nom és obligatori'),
  cognoms: z.string().trim().optional(),
  nif: nifSchema.optional(),
  representantNom: z.string().trim().optional(),
  representantNif: nifSchema.optional(),
  representantCarrec: z.string().trim().optional(),
  email: z.string().trim().email('Email no vàlid').optional(),
  telefon: z.string().trim().optional(),
  iban: z.string().trim().optional(),
  adreca: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const crearPropietariSchema = basePersonaSchema;
export type CrearPropietari = z.infer<typeof crearPropietariSchema>;

export const crearInquiliSchema = basePersonaSchema;
export type CrearInquili = z.infer<typeof crearInquiliSchema>;

export const actualitzarPersonaSchema = basePersonaSchema.partial();
export type ActualitzarPersona = z.infer<typeof actualitzarPersonaSchema>;

export const llistarPersonesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  estatInquili: estatInquiliEnum.optional(),
});
export type LlistarPersonesQuery = z.infer<typeof llistarPersonesQuerySchema>;
