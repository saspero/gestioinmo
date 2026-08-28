import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../lib/validations/common';
import { cobrarPagamentSchema } from '../../../../../lib/validations/pagaments';
import { cobrarPagament } from '../../../../../lib/db/pagaments';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Rebut no trobat.');

    const body = await request.json().catch(() => null);
    const parsed = cobrarPagamentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de cobrament no vàlides.', zodFieldErrors(parsed.error));
    }

    const pagament = await withTenantContext(auth.payload, (client) => cobrarPagament(client, id, parsed.data));
    if (!pagament) return apiError('NOT_FOUND', 'Rebut no trobat.');
    return apiSuccess(pagament);
  });
}
