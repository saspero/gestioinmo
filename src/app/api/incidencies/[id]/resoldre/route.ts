import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { uuidSchema, zodFieldErrors } from '../../../../../lib/validations/common';
import { resoldreIncidenciaSchema } from '../../../../../lib/validations/incidencies';
import { resoldreIncidencia } from '../../../../../lib/db/incidencies';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'incidencies', 'escriptura');
    if (!auth.ok) return auth.response;

    const { id } = await params;
    if (!uuidSchema.safeParse(id).success) return apiError('NOT_FOUND', 'Incidència no trobada.');

    const body = await request.json().catch(() => ({}));
    const parsed = resoldreIncidenciaSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de resolució no vàlides.', zodFieldErrors(parsed.error));
    }

    const incidencia = await withTenantContext(auth.payload, (client) => resoldreIncidencia(client, id, parsed.data));
    if (!incidencia) return apiError('NOT_FOUND', 'Incidència no trobada.');
    return apiSuccess(incidencia);
  });
}
