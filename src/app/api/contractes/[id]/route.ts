import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../lib/validations/common';
import { actualitzarContracteSchema } from '../../../../lib/validations/contractes';
import { obtenirContracte, actualitzarContracte, donarBaixaContracte, llistarInquilinsContracte } from '../../../../lib/db/contractes';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Contracte no trobat.');

    const contracte = await withTenantContext(auth.payload, async (client) => {
      const trobat = await obtenirContracte(client, id);
      if (!trobat) return null;
      const inquilinsIds = await llistarInquilinsContracte(client, id);
      return { ...trobat, inquilinsIds };
    });
    if (!contracte) return apiError('NOT_FOUND', 'Contracte no trobat.');
    return apiSuccess(contracte);
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Contracte no trobat.');

    const body = await request.json().catch(() => null);
    const parsed = actualitzarContracteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades del contracte no vàlides.', zodFieldErrors(parsed.error));
    }

    const contracte = await withTenantContext(auth.payload, (client) => actualitzarContracte(client, id, parsed.data));
    if (!contracte) return apiError('NOT_FOUND', 'Contracte no trobat.');
    return apiSuccess(contracte);
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Contracte no trobat.');

    const donada = await withTenantContext(auth.payload, (client) => donarBaixaContracte(client, id));
    if (!donada) return apiError('NOT_FOUND', 'Contracte no trobat.');
    return apiSuccess({ id });
  });
}
