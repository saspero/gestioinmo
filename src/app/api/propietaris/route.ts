import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../_lib/auth';
import { runHandler } from '../_lib/handler';
import { apiError, apiSuccess } from '../../../lib/errors';
import { withTenantContext } from '../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../lib/validations/common';
import { crearPropietariSchema, llistarPersonesQuerySchema } from '../../../lib/validations/persones';
import { crearPersona, llistarPersones } from '../../../lib/db/persones';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietaris', 'lectura');
    if (!auth.ok) return auth.response;

    const parsed = llistarPersonesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Paràmetres de cerca no vàlids.', zodFieldErrors(parsed.error));
    }

    const { data, meta } = await withTenantContext(auth.payload, (client) =>
      llistarPersones(client, 'propietari', parsed.data)
    );
    return apiSuccess(data, meta);
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'propietaris', 'escriptura');
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = crearPropietariSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades del propietari no vàlides.', zodFieldErrors(parsed.error));
    }

    const propietari = await withTenantContext(auth.payload, (client) => crearPersona(client, 'propietari', parsed.data));
    return apiSuccess(propietari, undefined, 201);
  });
}
