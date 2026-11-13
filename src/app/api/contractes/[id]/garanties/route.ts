import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../lib/validations/common';
import { crearGarantiaSchema } from '../../../../../lib/validations/contractes';
import { crearGarantia, llistarGaranties, obtenirContracte } from '../../../../../lib/db/contractes';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Contracte no trobat.');

    const garanties = await withTenantContext(auth.payload, async (client) => {
      if (!(await obtenirContracte(client, id))) return null;
      return llistarGaranties(client, id);
    });
    if (!garanties) return apiError('NOT_FOUND', 'Contracte no trobat.');
    return apiSuccess(garanties);
  });
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Contracte no trobat.');

    const body = await request.json().catch(() => null);
    const parsed = crearGarantiaSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la garantia no vàlides.', zodFieldErrors(parsed.error));
    }

    const garantia = await withTenantContext(auth.payload, async (client) => {
      if (!(await obtenirContracte(client, id))) return null;
      return crearGarantia(client, id, parsed.data);
    });
    if (!garantia) return apiError('NOT_FOUND', 'Contracte no trobat.');
    return apiSuccess(garantia, undefined, 201);
  });
}
