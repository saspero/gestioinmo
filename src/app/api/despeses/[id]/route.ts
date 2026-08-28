import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../lib/validations/common';
import { actualitzarDespesaSchema } from '../../../../lib/validations/despeses';
import { obtenirDespesa, actualitzarDespesa, donarBaixaDespesa } from '../../../../lib/db/despeses';

const MODUL = 'despeses';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, MODUL, 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Despesa no trobada.');

    const despesa = await withTenantContext(auth.payload, (client) => obtenirDespesa(client, id));
    if (!despesa) return apiError('NOT_FOUND', 'Despesa no trobada.');
    return apiSuccess(despesa);
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, MODUL, 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Despesa no trobada.');

    const body = await request.json().catch(() => null);
    const parsed = actualitzarDespesaSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la despesa no vàlides.', zodFieldErrors(parsed.error));
    }

    const despesa = await withTenantContext(auth.payload, (client) => actualitzarDespesa(client, id, parsed.data));
    if (!despesa) return apiError('NOT_FOUND', 'Despesa no trobada.');
    return apiSuccess(despesa);
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, MODUL, 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Despesa no trobada.');

    const donada = await withTenantContext(auth.payload, (client) => donarBaixaDespesa(client, id));
    if (!donada) return apiError('NOT_FOUND', 'Despesa no trobada.');
    return apiSuccess({ id });
  });
}
