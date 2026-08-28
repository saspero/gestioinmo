import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../lib/validations/common';
import { crearUnitatSchema } from '../../../../../lib/validations/propietats';
import { crearUnitat, llistarUnitats, obtenirPropietat } from '../../../../../lib/db/propietats';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Propietat no trobada.');

    const unitats = await withTenantContext(auth.payload, async (client) => {
      const propietat = await obtenirPropietat(client, id);
      if (!propietat) return null;
      return llistarUnitats(client, id);
    });
    if (unitats === null) return apiError('NOT_FOUND', 'Propietat no trobada.');
    return apiSuccess(unitats);
  });
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Propietat no trobada.');

    const body = await request.json().catch(() => null);
    const parsed = crearUnitatSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la unitat no vàlides.', zodFieldErrors(parsed.error));
    }

    const unitat = await withTenantContext(auth.payload, async (client) => {
      const propietat = await obtenirPropietat(client, id);
      if (!propietat) return null;
      return crearUnitat(client, id, parsed.data);
    });
    if (!unitat) return apiError('NOT_FOUND', 'Propietat no trobada.');
    return apiSuccess(unitat, undefined, 201);
  });
}
