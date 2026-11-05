import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { uuidSchema } from '../../../../../lib/validations/common';
import { llistarPropietatsDePropietari } from '../../../../../lib/db/propietats';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietaris', 'lectura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Propietari no trobat.');

    const propietats = await withTenantContext(auth.payload, (client) => llistarPropietatsDePropietari(client, id));
    return apiSuccess(propietats);
  });
}
