import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { authorize } from '../_lib/auth';
import { runHandler } from '../_lib/handler';
import { apiError, apiSuccess } from '../../../lib/errors';
import { withTenantContext } from '../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../lib/validations/common';
import { crearDespesaSchema, llistarDespesesQuerySchema } from '../../../lib/validations/despeses';
import { crearDespesa, llistarDespeses } from '../../../lib/db/despeses';

// No hi ha un Modul 'despeses' propi a src/lib/auth/rbac.ts (docs/requirements.md §2.2
// no en defineix una fila): les despeses alimenten directament `liquidacions.total_despeses`
// i viuen al mateix domini funcional que `pagaments` (011_tenant_despeses.sql), del qual
// reutilitzen el nivell de permisos (Admin T, Gestor T, Comptable T).
const MODUL = 'pagaments';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, MODUL, 'lectura');
    if (!auth.ok) return auth.response;

    const parsed = llistarDespesesQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Paràmetres de cerca no vàlids.', zodFieldErrors(parsed.error));
    }

    const { data, meta } = await withTenantContext(auth.payload, (client) => llistarDespeses(client, parsed.data));
    return apiSuccess(data, meta);
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, MODUL, 'escriptura');
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = crearDespesaSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Dades de la despesa no vàlides.', zodFieldErrors(parsed.error));
    }

    const despesa = await withTenantContext(auth.payload, (client) => crearDespesa(client, parsed.data));
    return apiSuccess(despesa, undefined, 201);
  });
}
