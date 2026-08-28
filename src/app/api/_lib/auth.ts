// Helper d'autenticació/autorització compartit pels route handlers d'aquest agent
// (src/app/api/**). Llegeix la cookie httpOnly del login (AUTH_COOKIE_NAME, Agent Auth
// Specialist), la verifica amb `verifyToken` i comprova permisos amb `can()` abans que
// el handler toqui `lib/db/` (docs/agents/AGENT_API.md §7).

import type { NextRequest } from 'next/server';
import { verifyToken, type JwtPayload } from '../../../lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '../../../lib/auth/session';
import { can, type Modul, type Accio } from '../../../lib/auth/rbac';
import { apiError } from '../../../lib/errors';

export type AuthResult = { ok: true; payload: JwtPayload } | { ok: false; response: ReturnType<typeof apiError> };

/** Verifica el JWT de la petició. Retorna `401` si absent/invàlid/expirat. */
export async function authenticate(request: NextRequest): Promise<AuthResult> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return { ok: false, response: apiError('UNAUTHORIZED', 'No autenticat.') };
  }
  const payload = await verifyToken(token);
  if (!payload) {
    return { ok: false, response: apiError('UNAUTHORIZED', 'Sessió no vàlida o expirada.') };
  }
  return { ok: true, payload };
}

/** `authenticate` + comprovació RBAC (`can()`) — AGENT_API.md §7: GET requereix
 *  `lectura`; POST/PATCH/DELETE requereixen `escriptura`. `403` immediat si falla,
 *  sense tocar `lib/db/`. */
export async function authorize(request: NextRequest, modul: Modul, accio: Accio): Promise<AuthResult> {
  const auth = await authenticate(request);
  if (!auth.ok) return auth;

  if (!can(auth.payload.rol, modul, accio)) {
    return { ok: false, response: apiError('FORBIDDEN', 'No tens permís per a aquesta operació.') };
  }
  return auth;
}
