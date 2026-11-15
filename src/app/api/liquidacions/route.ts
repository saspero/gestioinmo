import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../_lib/auth';
import { runHandler } from '../_lib/handler';
import { apiError, apiSuccess } from '../../../lib/errors';
import { withTenantContext } from '../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../lib/validations/common';
import { generarLiquidacionsSchema, llistarLiquidacionsQuerySchema } from '../../../lib/validations/liquidacions';
import { generarLiquidacions, llistarLiquidacions } from '../../../lib/db/liquidacions';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'lectura');
    if (!auth.ok) return auth.response;

    const parsed = llistarLiquidacionsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Paràmetres de cerca no vàlids.', zodFieldErrors(parsed.error));
    }

    const { data, meta } = await withTenantContext(auth.payload, (client) => llistarLiquidacions(client, parsed.data));
    return apiSuccess(data, meta);
  });
}

/** Genera les liquidacions d'un període (una per propietari amb alguna cosa per liquidar). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'escriptura');
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = generarLiquidacionsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Període no vàlid.', zodFieldErrors(parsed.error));
    }

    const creades = await withTenantContext(auth.payload, (client) => generarLiquidacions(client, parsed.data));
    return apiSuccess(creades, undefined, 201);
  });
}
