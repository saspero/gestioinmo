import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../lib/validations/common';
import { resoldreContracteSchema } from '../../../../../lib/validations/contractes';
import { resoldreContracte } from '../../../../../lib/db/contractes';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Contracte no trobat.');

    const body = await request.json().catch(() => null);
    const parsed = resoldreContracteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de resolució no vàlides.', zodFieldErrors(parsed.error));
    }

    const contracte = await withTenantContext(auth.payload, (client) => resoldreContracte(client, id, parsed.data));
    if (!contracte) return apiError('NOT_FOUND', 'Contracte no trobat.');
    return apiSuccess(contracte);
  });
}
