import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../lib/validations/common';
import { pagarLiquidacioSchema } from '../../../../../lib/validations/liquidacions';
import { pagarLiquidacio } from '../../../../../lib/db/liquidacions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Marca la liquidació com a pagada al propietari. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Liquidació no trobada.');

    const body = await request.json().catch(() => null);
    const parsed = pagarLiquidacioSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Data de pagament no vàlida.', zodFieldErrors(parsed.error));
    }

    const liquidacio = await withTenantContext(auth.payload, (client) => pagarLiquidacio(client, id, parsed.data));
    if (!liquidacio) return apiError('NOT_FOUND', 'Liquidació no trobada.');
    return apiSuccess(liquidacio);
  });
}
