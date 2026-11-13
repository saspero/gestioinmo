import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../lib/validations/common';
import { crearConcepteSchema } from '../../../../../lib/validations/contractes';
import { crearConcepte, llistarConceptes, obtenirContracte } from '../../../../../lib/db/contractes';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Historial de la renda i de les despeses repercutides del contracte. */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Contracte no trobat.');

    const conceptes = await withTenantContext(auth.payload, async (client) => {
      if (!(await obtenirContracte(client, id))) return null;
      return llistarConceptes(client, id);
    });
    if (!conceptes) return apiError('NOT_FOUND', 'Contracte no trobat.');
    return apiSuccess(conceptes);
  });
}

/** Afegeix una despesa repercutida. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Contracte no trobat.');

    const body = await request.json().catch(() => null);
    const parsed = crearConcepteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la despesa no vàlides.', zodFieldErrors(parsed.error));
    }

    const concepte = await withTenantContext(auth.payload, async (client) => {
      if (!(await obtenirContracte(client, id))) return null;
      return crearConcepte(client, id, parsed.data);
    });
    if (!concepte) return apiError('NOT_FOUND', 'Contracte no trobat.');
    return apiSuccess(concepte, undefined, 201);
  });
}
