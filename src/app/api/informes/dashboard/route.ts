import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiError, apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../../lib/validations/common';
import { dashboardQuerySchema } from '../../../../lib/validations/informes';
import { obtenirDashboard } from '../../../../lib/db/informes';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'informes', 'lectura');
    if (!auth.ok) return auth.response;

    const parsed = dashboardQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Paràmetres de filtre no vàlids.', zodFieldErrors(parsed.error));
    }

    const indicadors = await withTenantContext(auth.payload, (client) => obtenirDashboard(client, parsed.data));
    return apiSuccess(indicadors);
  });
}
