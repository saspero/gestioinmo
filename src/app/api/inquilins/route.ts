import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../_lib/auth';
import { runHandler } from '../_lib/handler';
import { apiError, apiSuccess } from '../../../lib/errors';
import { withTenantContext } from '../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../lib/validations/common';
import { crearInquiliSchema, llistarPersonesQuerySchema } from '../../../lib/validations/persones';
import { crearPersona, llistarPersones } from '../../../lib/db/persones';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'inquilins', 'lectura');
    if (!auth.ok) return auth.response;

    const parsed = llistarPersonesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Paràmetres de cerca no vàlids.', zodFieldErrors(parsed.error));
    }

    const { data, meta } = await withTenantContext(auth.payload, (client) =>
      llistarPersones(client, 'inquili', parsed.data)
    );
    return apiSuccess(data, meta);
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'inquilins', 'escriptura');
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = crearInquiliSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', "Dades de l'inquilí no vàlides.", zodFieldErrors(parsed.error));
    }

    const inquili = await withTenantContext(auth.payload, (client) => crearPersona(client, 'inquili', parsed.data));
    return apiSuccess(inquili, undefined, 201);
  });
}
