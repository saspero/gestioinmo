import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../lib/validations/common';
import { actualitzarPropietatSchema } from '../../../../lib/validations/propietats';
import { obtenirPropietat, actualitzarPropietat, donarBaixaPropietat } from '../../../../lib/db/propietats';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Propietat no trobada.');

    const propietat = await withTenantContext(auth.payload, (client) => obtenirPropietat(client, id));
    if (!propietat) return apiError('NOT_FOUND', 'Propietat no trobada.');
    return apiSuccess(propietat);
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Propietat no trobada.');

    const body = await request.json().catch(() => null);
    const parsed = actualitzarPropietatSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la propietat no vàlides.', zodFieldErrors(parsed.error));
    }

    const propietat = await withTenantContext(auth.payload, (client) => actualitzarPropietat(client, id, parsed.data));
    if (!propietat) return apiError('NOT_FOUND', 'Propietat no trobada.');
    return apiSuccess(propietat);
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Propietat no trobada.');

    const donada = await withTenantContext(auth.payload, (client) => donarBaixaPropietat(client, id));
    if (!donada) return apiError('NOT_FOUND', 'Propietat no trobada.');
    return apiSuccess({ id });
  });
}
