import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../../../_lib/auth';
import { runHandler } from '../../../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../../../lib/errors';
import { withTenantContext } from '../../../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../../../lib/validations/common';
import { modificarConcepteSchema } from '../../../../../../../lib/validations/contractes';
import { modificarConcepte } from '../../../../../../../lib/db/contractes';

interface RouteParams {
  params: Promise<{ id: string; concepteId: string }>;
}

/** Nou import (també de la renda) a partir d'una data d'efecte. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id, concepteId } = await params;
    if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(concepteId).success) {
      return apiError('NOT_FOUND', 'Concepte no trobat.');
    }

    const body = await request.json().catch(() => null);
    const parsed = modificarConcepteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades del canvi no vàlides.', zodFieldErrors(parsed.error));
    }

    const concepte = await withTenantContext(auth.payload, (client) =>
      modificarConcepte(client, id, concepteId, parsed.data)
    );
    if (!concepte) return apiError('NOT_FOUND', 'Concepte no trobat.');
    return apiSuccess(concepte, undefined, 201);
  });
}
