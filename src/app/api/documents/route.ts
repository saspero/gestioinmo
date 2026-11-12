import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authenticate } from '../_lib/auth';
import { runHandler } from '../_lib/handler';
import { apiError, apiSuccess } from '../../../lib/errors';
import { withTenantContext } from '../../../lib/auth/tenant-context';
import { crearDocument, entitatExisteix, llistarDocuments } from '../../../lib/db/documents';
import { zodFieldErrors } from '../../../lib/validations/common';
import {
  crearDocumentSchema,
  llistarDocumentsQuerySchema,
  MIDA_PART_DOCUMENT,
  potGestionarDocuments,
} from '../../../lib/validations/documents';

/** Documents d'una fitxa: `?entitat=propietat&entitatId=...`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.response;

    const parsed = llistarDocumentsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Paràmetres no vàlids.', zodFieldErrors(parsed.error));
    }
    const { entitat, entitatId } = parsed.data;
    if (!potGestionarDocuments(auth.payload.rol, entitat, 'lectura')) {
      return apiError('FORBIDDEN', 'No tens permís per a aquesta operació.');
    }

    const documents = await withTenantContext(auth.payload, (client) => llistarDocuments(client, entitat, entitatId));
    return apiSuccess(documents);
  });
}

/**
 * Comença la pujada d'un document. Retorna la fitxa i la mida dels trossos: el client
 * n'envia cadascun a `PUT /api/documents/{id}/parts/{idx}` i acaba amb
 * `POST /api/documents/{id}/completar`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authenticate(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = crearDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades del document no vàlides.', zodFieldErrors(parsed.error));
    }
    if (!potGestionarDocuments(auth.payload.rol, parsed.data.entitat, 'escriptura')) {
      return apiError('FORBIDDEN', 'No tens permís per a aquesta operació.');
    }

    const document = await withTenantContext(auth.payload, async (client) => {
      if (!(await entitatExisteix(client, parsed.data.entitat, parsed.data.entitatId))) return null;
      return crearDocument(client, parsed.data, auth.payload.sub);
    });
    if (!document) return apiError('NOT_FOUND', "No s'ha trobat la fitxa on adjuntar el document.");
    return apiSuccess({ ...document, midaPart: MIDA_PART_DOCUMENT }, undefined, 201);
  });
}
