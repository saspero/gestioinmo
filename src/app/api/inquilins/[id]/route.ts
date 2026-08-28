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
    const auth = await authorize(request, 'inquilins', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Inquilí no trobat.');

    const inquili = await withTenantContext(auth.payload, (client) => obtenirPersona(client, id, 'inquili'));
    if (!inquili) return apiError('NOT_FOUND', 'Inquilí no trobat.');
    return apiSuccess(inquili);
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'inquilins', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Inquilí no trobat.');

    const body = await request.json().catch(() => null);
    const parsed = actualitzarPersonaSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', "Dades de l'inquilí no vàlides.", zodFieldErrors(parsed.error));
    }

    const inquili = await withTenantContext(auth.payload, (client) =>
      actualitzarPersona(client, id, 'inquili', parsed.data)
    );
    if (!inquili) return apiError('NOT_FOUND', 'Inquilí no trobat.');
    return apiSuccess(inquili);
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'inquilins', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Inquilí no trobat.');

    const donada = await withTenantContext(auth.payload, (client) => donarBaixaPersona(client, id, 'inquili'));
    if (!donada) return apiError('NOT_FOUND', 'Inquilí no trobat.');
    return apiSuccess({ id });
  });
}
