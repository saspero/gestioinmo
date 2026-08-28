import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../lib/validations/common';
import { actualitzarPagamentSchema } from '../../../../lib/validations/pagaments';
import { obtenirPagament, actualitzarPagament, anularPagament } from '../../../../lib/db/pagaments';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Rebut no trobat.');

    const pagament = await withTenantContext(auth.payload, (client) => obtenirPagament(client, id));
    if (!pagament) return apiError('NOT_FOUND', 'Rebut no trobat.');
    return apiSuccess(pagament);
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Rebut no trobat.');

    const body = await request.json().catch(() => null);
    const parsed = actualitzarPagamentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades del rebut no vàlides.', zodFieldErrors(parsed.error));
    }

    const pagament = await withTenantContext(auth.payload, (client) => actualitzarPagament(client, id, parsed.data));
    if (!pagament) return apiError('NOT_FOUND', 'Rebut no trobat.');
    return apiSuccess(pagament);
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Rebut no trobat.');

    const anulada = await withTenantContext(auth.payload, (client) => anularPagament(client, id));
    if (!anulada) return apiError('NOT_FOUND', 'Rebut no trobat.');
    return apiSuccess({ id });
  });
}
