import { z } from 'zod';

export const provisionarTenantSchema = z.object({
  nom: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug només admet minúscules, números i guions.'),
  admin: z.object({
    email: z.string().trim().toLowerCase().email(),
    nom: z.string().trim().min(1),
    cognoms: z.string().trim().min(1).optional(),
    password: z.string().min(12, 'La contrasenya ha de tenir almenys 12 caràcters.'),
    /** Contrasenya generada: l'administrador n'haurà de triar una de pròpia en entrar. */
    canviContrasenya: z.boolean().default(false),
  }),
});

export type ProvisionarTenantInput = z.input<typeof provisionarTenantSchema>;
