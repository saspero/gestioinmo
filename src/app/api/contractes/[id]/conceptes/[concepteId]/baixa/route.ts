import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../../../_lib/auth';
import { runHandler } from '../../../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../../../lib/errors';
import { withTenantContext } from '../../../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../../../lib/validations/common';
import { baixaConcepteSchema } from '../../../../../../../lib/validations/contractes';
import { donarBaixaConcepte } from '../../../../../../../lib/db/contractes';

interface RouteParams {
  params: Promise<{ id: string; concepteId: string }>;
}

/** Deixa de cobrar una despesa a partir d'una data. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id, concepteId } = await params;
    if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(concepteId).success) {
      return apiError('NOT_FOUND', 'Concepte no trobat.');
    }

    const body = await request.json().catch(() => null);
    const parsed = baixaConcepteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Data no vàlida.', zodFieldErrors(parsed.error));
    }

    const concepte = await withTenantContext(auth.payload, (client) =>
      donarBaixaConcepte(client, id, concepteId, parsed.data)
    );
    if (!concepte) return apiError('NOT_FOUND', 'Concepte no trobat.');
    return apiSuccess(concepte);
  });
}
