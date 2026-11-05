import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Introdueix un email vàlid.'),
  password: z.string().min(1, 'Introdueix la contrasenya.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
