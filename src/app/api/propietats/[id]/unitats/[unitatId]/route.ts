import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../../_lib/auth';
import { runHandler } from '../../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../../lib/errors';
import { withTenantContext } from '../../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../../lib/validations/common';
import { actualitzarUnitatSchema } from '../../../../../../lib/validations/propietats';
import { obtenirUnitat, actualitzarUnitat, donarBaixaUnitat } from '../../../../../../lib/db/propietats';

interface RouteParams {
  params: Promise<{ id: string; unitatId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'lectura');
    if (!auth.ok) return auth.response;

    const { id, unitatId } = await params;
    if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(unitatId).success) {
      return apiError('NOT_FOUND', 'Unitat no trobada.');
    }

    const unitat = await withTenantContext(auth.payload, (client) => obtenirUnitat(client, unitatId, id));
    if (!unitat) return apiError('NOT_FOUND', 'Unitat no trobada.');
    return apiSuccess(unitat);
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id, unitatId } = await params;
    if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(unitatId).success) {
      return apiError('NOT_FOUND', 'Unitat no trobada.');
    }

    const body = await request.json().catch(() => null);
    const parsed = actualitzarUnitatSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la unitat no vàlides.', zodFieldErrors(parsed.error));
    }

    const unitat = await withTenantContext(auth.payload, (client) =>
      actualitzarUnitat(client, unitatId, id, parsed.data)
    );
    if (!unitat) return apiError('NOT_FOUND', 'Unitat no trobada.');
    return apiSuccess(unitat);
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id, unitatId } = await params;
    if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(unitatId).success) {
      return apiError('NOT_FOUND', 'Unitat no trobada.');
    }

    const donada = await withTenantContext(auth.payload, (client) => donarBaixaUnitat(client, unitatId, id));
    if (!donada) return apiError('NOT_FOUND', 'Unitat no trobada.');
    return apiSuccess({ id: unitatId });
  });
}
