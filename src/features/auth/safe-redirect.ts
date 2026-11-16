export const RUTA_PER_DEFECTE = '/dashboard';

/** Només admet rutes internes: evita un open redirect via `/login?from=//altre-domini`. */
export function rutaSegura(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/')) return RUTA_PER_DEFECTE;
  // Els navegadors ignoren tabuladors i salts de línia a les URL: `/\t/altre.com` seria `//altre.com`.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(from)) return RUTA_PER_DEFECTE;
  if (from.startsWith('//') || from.includes('\\') || from.startsWith('/login')) return RUTA_PER_DEFECTE;
  return from;
}
