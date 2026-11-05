export const RUTA_PER_DEFECTE = '/informes';

/** Només admet rutes internes: evita un open redirect via `/login?from=//altre-domini`. */
export function rutaSegura(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/')) return RUTA_PER_DEFECTE;
  if (from.startsWith('//') || from.includes('\\') || from.startsWith('/login')) return RUTA_PER_DEFECTE;
  return from;
}
