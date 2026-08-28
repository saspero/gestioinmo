import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../_lib/auth';
import { runHandler } from '../_lib/handler';
import { apiError, apiSuccess } from '../../../lib/errors';
import { withTenantContext } from '../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../lib/validations/common';
import { crearIncidenciaSchema, llistarIncidenciesQuerySchema } from '../../../lib/validations/incidencies';
import { crearIncidencia, llistarIncidencies } from '../../../lib/db/incidencies';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'incidencies', 'lectura');
    if (!auth.ok) return auth.response;

    const parsed = llistarIncidenciesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Paràmetres de cerca no vàlids.', zodFieldErrors(parsed.error));
    }

    const { data, meta } = await withTenantContext(auth.payload, (client) => llistarIncidencies(client, parsed.data));
    return apiSuccess(data, meta);
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'incidencies', 'escriptura');
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = crearIncidenciaSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la incidència no vàlides.', zodFieldErrors(parsed.error));
    }

    const incidencia = await withTenantContext(auth.payload, (client) => crearIncidencia(client, parsed.data));
    return apiSuccess(incidencia, undefined, 201);
  });
}
