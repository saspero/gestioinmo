import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../_lib/auth';
import { runHandler } from '../../_lib/handler';
import { apiSuccess } from '../../../../lib/errors';
import { withTenantContext } from '../../../../lib/auth/tenant-context';
import { avuiLocal } from '../../../../lib/validations/contractes';
import { llistarAvisosContractes } from '../../../../lib/db/contractes';

/** Avisos dels contractes actius: actualització de la renda i termini per no renovar. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'contractes', 'lectura');
    if (!auth.ok) return auth.response;

    const avisos = await withTenantContext(auth.payload, (client) => llistarAvisosContractes(client, avuiLocal()));
    return apiSuccess(avisos);
  });
}
