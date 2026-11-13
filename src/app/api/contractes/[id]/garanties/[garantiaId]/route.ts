import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../../_lib/auth';
import { runHandler } from '../../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../../lib/errors';
import { withTenantContext } from '../../../../../../lib/auth/tenant-context';
import { uuidSchema } from '../../../../../../lib/validations/common';
import { esborrarGarantia } from '../../../../../../lib/db/contractes';

interface RouteParams {
  params: Promise<{ id: string; garantiaId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id, garantiaId } = await params;
    if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(garantiaId).success) {
      return apiError('NOT_FOUND', 'Garantia no trobada.');
    }

    const esborrada = await withTenantContext(auth.payload, (client) => esborrarGarantia(client, id, garantiaId));
    if (!esborrada) return apiError('NOT_FOUND', 'Garantia no trobada.');
    return apiSuccess({ id: garantiaId });
  });
}
