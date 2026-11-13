import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../../lib/validations/common';
import { generarRebutsSchema } from '../../../../lib/validations/pagaments';
import { generarRebuts } from '../../../../lib/db/pagaments';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'pagaments', 'escriptura');
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = generarRebutsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Mes no vàlid.', zodFieldErrors(parsed.error));
    }

    const resultat = await withTenantContext(auth.payload, (client) => generarRebuts(client, parsed.data));
    return apiSuccess(resultat);
  });
}
