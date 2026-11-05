import { z } from 'zod';

const textOpcional = z
  .string()
  .trim()
  .transform((valor) => valor || undefined)
  .optional();

export const actualitzarTenantSchema = z.object({
  nom: z.string().trim().min(1, "El nom de l'agència és obligatori."),
  nif: textOpcional,
  adreca: textOpcional,
  jwtExpiracioMinuts: z.coerce
    .number()
    .int('Ha de ser un nombre enter de minuts.')
    .min(5, 'El mínim són 5 minuts.')
    .max(1440, 'El màxim són 1440 minuts (24 hores).'),
});
export type ActualitzarTenant = z.infer<typeof actualitzarTenantSchema>;

export const crearUsuariSchema = z.object({
  email: z.string().trim().toLowerCase().email('Introdueix un email vàlid.'),
  nom: z.string().trim().min(1, 'El nom és obligatori.'),
  cognoms: textOpcional,
  rol: z.enum(['admin', 'gestor', 'comptable']),
});
export type CrearUsuari = z.infer<typeof crearUsuariSchema>;
