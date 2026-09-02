// Helper de sessió per als Server Components de `(dashboard)` (aquest agent, Feature
// Developer). No pertany a `src/lib/auth/**` (Auth Specialist): només reutilitza els
// exports ja existents d'allà (`verifyToken`, `AUTH_COOKIE_NAME`, `can`) per resoldre el
// `rol`/`tenant_id` un cop per petició, tal com ja fa `src/app/api/_lib/auth.ts` per als
// route handlers (docs/architecture.md §3: "El de (dashboard) resol la sessió i el rol
// una única vegada"). `cache()` de React deduplica la lectura entre el layout i cada
// pàgina niada dins la mateixa petició.

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyToken, type JwtPayload } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { can, type Modul, type Accio } from '@/lib/auth/rbac';

/** Verifica el JWT de la cookie de sessió. Redirigeix a `/login` si absent/invàlid —
 *  no hauria de passar mai (el middleware ja protegeix `(dashboard)`), és defensa en
 *  profunditat per si un Server Component es renderitza sense haver passat pel middleware. */
export const getDashboardSession = cache(async (): Promise<JwtPayload> => {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) {
    redirect('/login');
  }
  return payload;
});

export type ModuleAccess = { payload: JwtPayload; allowed: boolean };

/** Sessió + comprovació RBAC (`can()`, docs/requirements.md §2.2) per a un mòdul/acció
 *  concrets. No llença: qui crida decideix què renderitzar si `allowed` és `false`
 *  (patró 403 d'`docs/ux-flows.md` §4, mai s'arriba per navegació normal). */
export async function getModuleAccess(modul: Modul, accio: Accio = 'lectura'): Promise<ModuleAccess> {
  const payload = await getDashboardSession();
  return { payload, allowed: can(payload.rol, modul, accio) };
}
