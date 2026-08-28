// Schemas Zod compartits per tots els mòduls (docs/agents/AGENT_API.md §3/§6).

import { z, type ZodError } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().min(1).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const uuidSchema = z.string().uuid('Identificador no vàlid');

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no vàlida (format YYYY-MM-DD)');

/** Aplana un `ZodError` a `Record<string, string>` per al camp `fields` de l'envelope
 *  d'error (docs/architecture.md §5.1: "detall per camp, ex: sortida de Zod .flatten()"). */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const { fieldErrors } = error.flatten();
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
      .map(([field, messages]) => [field, messages.join(', ')])
  );
}
