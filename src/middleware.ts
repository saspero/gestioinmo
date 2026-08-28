// Protecció de rutes (docs/agents/AGENT_AUTH.md §3, docs/architecture.md §7).
//
// Corre en Edge Runtime: només importa `./lib/auth/jwt` (jose + zod, sense dependències
// de Node natives). No importa `./lib/auth/session` ni `./lib/auth/tenant-context`
// perquè arrosseguen `pg`, que no és compatible amb Edge Runtime i obriria connexions
// directes a PostgreSQL des del middleware — prohibit per docs/architecture.md §1/§7.
// Per això `AUTH_COOKIE_NAME` es duplica aquí com a constant literal en lloc
// d'importar-la de `session.ts`; ha de coincidir amb el valor exportat allà.
//
// Comprovació de revocació de sessió: es confia en l'`exp` del JWT (`verifyToken` ja el
// valida) i NO es consulta `tenant_user_sessions` a cada petició, tal com documenta
// `isSessionActive` a `session.ts` — aquesta consulta es reserva per a operacions
// sensibles fetes des de Server Actions/route handlers, no des del middleware d'Edge.

import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from './lib/auth/jwt';

/** Ha de coincidir amb `AUTH_COOKIE_NAME` de `src/lib/auth/session.ts`. */
const AUTH_COOKIE_NAME = 'gestinmo_session';

const LOGIN_PATH = '/login';

/**
 * Headers interns via els quals el middleware propaga la identitat ja verificada als
 * route handlers (`docs/architecture.md` §7.4: reben el payload del JWT ja verificat,
 * no el re-verifiquen). Sobreescrits sempre aquí — mai llegits d'una petició entrant —
 * perquè un client no els pugui falsificar.
 */
const TENANT_ID_HEADER = 'x-tenant-id';
const USER_ID_HEADER = 'x-user-id';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;

  if (payload) {
    const headers = new Headers(request.headers);
    headers.set(TENANT_ID_HEADER, payload.tenant_id);
    headers.set(USER_ID_HEADER, payload.sub);
    return NextResponse.next({ request: { headers } });
  }

  const { pathname } = request.nextUrl;

  // Format d'error estàndard d'docs/architecture.md §5.1/§5.2 (401 = no autenticat).
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'No autenticat.' } },
      { status: 401 }
    );
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

// Protegeix totes les rutes de (dashboard) (arrel inclosa) i app/api/**.
// Exclou explícitament /login i les rutes de (auth), assets estàtics de Next.js,
// favicon i el manifest/robots públics.
export const config = {
  matcher: [
    '/((?!login|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
