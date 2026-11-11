import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Introdueix un email vàlid.'),
  password: z.string().min(1, 'Introdueix la contrasenya.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const LONGITUD_MINIMA_CONTRASENYA = 10;

// bcrypt ignora tot el que passa de 72 bytes: dues contrasenyes que només difereixin a
// partir d'aquí serien equivalents.
const MAX_BYTES_BCRYPT = 72;

export const canviContrasenyaSchema = z
  .object({
    actual: z.string().min(1, 'Introdueix la contrasenya actual.'),
    nova: z
      .string()
      .min(LONGITUD_MINIMA_CONTRASENYA, `Ha de tenir com a mínim ${LONGITUD_MINIMA_CONTRASENYA} caràcters.`)
      .refine((valor) => new TextEncoder().encode(valor).length <= MAX_BYTES_BCRYPT, 'És massa llarga.'),
    confirmacio: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.nova !== data.confirmacio) {
      ctx.addIssue({ code: 'custom', path: ['confirmacio'], message: 'Les contrasenyes no coincideixen.' });
    }
    if (data.actual && data.nova === data.actual) {
      ctx.addIssue({ code: 'custom', path: ['nova'], message: "Ha de ser diferent de l'actual." });
    }
  });

export type CanviContrasenyaInput = z.infer<typeof canviContrasenyaSchema>;
