import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../_lib/auth';
import { runHandler } from '../_lib/handler';
import { apiError, apiSuccess } from '../../../lib/errors';
import { withTenantContext } from '../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../lib/validations/common';
import { crearContracteSchema, llistarContractesQuerySchema } from '../../../lib/validations/contractes';
import { crearContracte, llistarContractes, llistarInquilinsContracte } from '../../../lib/db/contractes';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'lectura');
    if (!auth.ok) return auth.response;

    const parsed = llistarContractesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Paràmetres de cerca no vàlids.', zodFieldErrors(parsed.error));
    }

    const { data, meta } = await withTenantContext(auth.payload, (client) => llistarContractes(client, parsed.data));
    return apiSuccess(data, meta);
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'escriptura');
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = crearContracteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades del contracte no vàlides.', zodFieldErrors(parsed.error));
    }

    const contracte = await withTenantContext(auth.payload, async (client) => {
      const nou = await crearContracte(client, parsed.data);
      const inquilinsIds = await llistarInquilinsContracte(client, nou.id);
      return { ...nou, inquilinsIds };
    });
    return apiSuccess(contracte, undefined, 201);
  });
}
