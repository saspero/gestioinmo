import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../lib/validations/common';
import { actualitzarPersonaSchema } from '../../../../lib/validations/persones';
import { obtenirPersona, actualitzarPersona, donarBaixaPersona } from '../../../../lib/db/persones';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietaris', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Propietari no trobat.');

    const propietari = await withTenantContext(auth.payload, (client) => obtenirPersona(client, id, 'propietari'));
    if (!propietari) return apiError('NOT_FOUND', 'Propietari no trobat.');
    return apiSuccess(propietari);
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietaris', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Propietari no trobat.');

    const body = await request.json().catch(() => null);
    const parsed = actualitzarPersonaSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades del propietari no vàlides.', zodFieldErrors(parsed.error));
    }

    const propietari = await withTenantContext(auth.payload, (client) =>
      actualitzarPersona(client, id, 'propietari', parsed.data)
    );
    if (!propietari) return apiError('NOT_FOUND', 'Propietari no trobat.');
    return apiSuccess(propietari);
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietaris', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Propietari no trobat.');

    const donada = await withTenantContext(auth.payload, (client) => donarBaixaPersona(client, id, 'propietari'));
    if (!donada) return apiError('NOT_FOUND', 'Propietari no trobat.');
    return apiSuccess({ id });
  });
}
