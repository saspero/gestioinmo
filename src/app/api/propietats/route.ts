import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../_lib/auth';
import { runHandler } from '../_lib/handler';
import { apiError, apiSuccess } from '../../../lib/errors';
import { withTenantContext } from '../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../lib/validations/common';
import { crearPropietatSchema, llistarPropietatsQuerySchema } from '../../../lib/validations/propietats';
import { crearPropietat, llistarPropietats } from '../../../lib/db/propietats';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'lectura');
    if (!auth.ok) return auth.response;

    const parsed = llistarPropietatsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Paràmetres de cerca no vàlids.', zodFieldErrors(parsed.error));
    }

    const { data, meta } = await withTenantContext(auth.payload, (client) => llistarPropietats(client, parsed.data));
    return apiSuccess(data, meta);
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietats', 'escriptura');
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = crearPropietatSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la propietat no vàlides.', zodFieldErrors(parsed.error));
    }

    const propietat = await withTenantContext(auth.payload, (client) => crearPropietat(client, parsed.data));
    return apiSuccess(propietat, undefined, 201);
  });
}
