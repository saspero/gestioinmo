import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../lib/validations/common';
import { actualitzarIncidenciaSchema } from '../../../../lib/validations/incidencies';
import { obtenirIncidencia, actualitzarIncidencia, donarBaixaIncidencia } from '../../../../lib/db/incidencies';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'incidencies', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Incidència no trobada.');

    const incidencia = await withTenantContext(auth.payload, (client) => obtenirIncidencia(client, id));
    if (!incidencia) return apiError('NOT_FOUND', 'Incidència no trobada.');
    return apiSuccess(incidencia);
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'incidencies', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Incidència no trobada.');

    const body = await request.json().catch(() => null);
    const parsed = actualitzarIncidenciaSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la incidència no vàlides.', zodFieldErrors(parsed.error));
    }

    const incidencia = await withTenantContext(auth.payload, (client) => actualitzarIncidencia(client, id, parsed.data));
    if (!incidencia) return apiError('NOT_FOUND', 'Incidència no trobada.');
    return apiSuccess(incidencia);
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'incidencies', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Incidència no trobada.');

    const donada = await withTenantContext(auth.payload, (client) => donarBaixaIncidencia(client, id));
    if (!donada) return apiError('NOT_FOUND', 'Incidència no trobada.');
    return apiSuccess({ id });
  });
}
