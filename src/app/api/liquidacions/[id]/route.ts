import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { uuidSchema } from '../../../../lib/validations/common';
import { esborrarLiquidacio, llistarLiniesLiquidacio, obtenirLiquidacio } from '../../../../lib/db/liquidacions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Liquidació no trobada.');

    const liquidacio = await withTenantContext(auth.payload, async (client) => {
      const trobada = await obtenirLiquidacio(client, id);
      return trobada ? { ...trobada, linies: await llistarLiniesLiquidacio(client, id) } : null;
    });
    if (!liquidacio) return apiError('NOT_FOUND', 'Liquidació no trobada.');
    return apiSuccess(liquidacio);
  });
}

/** Esborra una liquidació no pagada: el que contenia torna a quedar per liquidar. */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Liquidació no trobada.');

    const esborrada = await withTenantContext(auth.payload, (client) => esborrarLiquidacio(client, id));
    if (!esborrada) return apiError('NOT_FOUND', 'Liquidació no trobada.');
    return apiSuccess({ id });
  });
}
