// Accés a un document existent: comprova la sessió, carrega el document i aplica els
// permisos de la fitxa on està adjuntat (`potGestionarDocuments`).

import type { NextRequest } from 'next/server';
import type { PoolClient } from 'pg';
import { authenticate } from '../_lib/auth';
import { apiError } from '../../../lib/errors';
import type { JwtPayload } from '../../../lib/auth/jwt';
import type { Accio } from '../../../lib/auth/rbac';
import { withTenantContext } from '../../../lib/auth/tenant-context';
import { obtenirDocument, type DocumentIntern } from '../../../lib/db/documents';
import { uuidSchema } from '../../../lib/validations/common';
import { potGestionarDocuments } from '../../../lib/validations/documents';

type Resultat<T> = { ok: true; valor: T } | { ok: false; response: ReturnType<typeof apiError> };

export async function ambDocument<T>(
  request: NextRequest,
  id: string,
  accio: Accio,
  fn: (client: PoolClient, document: DocumentIntern, payload: JwtPayload) => Promise<T>
): Promise<Resultat<T>> {
  const auth = await authenticate(request);
  if (!auth.ok) return auth;
  if (!uuidSchema.safeParse(id).success) return { ok: false, response: apiError('NOT_FOUND', 'Document no trobat.') };

  return withTenantContext(auth.payload, async (client): Promise<Resultat<T>> => {
    const document = await obtenirDocument(client, id);
    if (!document) return { ok: false, response: apiError('NOT_FOUND', 'Document no trobat.') };
    if (!potGestionarDocuments(auth.payload.rol, document.entitat, accio)) {
      return { ok: false, response: apiError('FORBIDDEN', 'No tens permís per a aquesta operació.') };
    }
    return { ok: true, valor: await fn(client, document, auth.payload) };
  });
}
