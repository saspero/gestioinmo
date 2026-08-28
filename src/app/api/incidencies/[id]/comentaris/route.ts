import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../lib/validations/common';
import { crearComentariSchema } from '../../../../../lib/validations/incidencies';
import { crearComentari, llistarComentaris, obtenirIncidencia } from '../../../../../lib/db/incidencies';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'incidencies', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Incidència no trobada.');

    const comentaris = await withTenantContext(auth.payload, async (client) => {
      const incidencia = await obtenirIncidencia(client, id);
      if (!incidencia) return null;
      return llistarComentaris(client, id);
    });
    if (comentaris === null) return apiError('NOT_FOUND', 'Incidència no trobada.');
    return apiSuccess(comentaris);
  });
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'incidencies', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Incidència no trobada.');

    const body = await request.json().catch(() => null);
    const parsed = crearComentariSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Comentari no vàlid.', zodFieldErrors(parsed.error));
    }

    const comentari = await withTenantContext(auth.payload, async (client) => {
      const incidencia = await obtenirIncidencia(client, id);
      if (!incidencia) return null;
      return crearComentari(client, id, auth.payload.sub, parsed.data);
    });
    if (!comentari) return apiError('NOT_FOUND', 'Incidència no trobada.');
    return apiSuccess(comentari, undefined, 201);
  });
}
