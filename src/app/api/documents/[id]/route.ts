import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { runHandler } from '../../_lib/handler';
import { apiSuccess } from '../../../../lib/errors';
import { esborrarDocument } from '../../../../lib/db/documents';
import { ambDocument } from '../acces';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const { id } = await params;
    const resultat = await ambDocument(request, id, 'escriptura', (client) => esborrarDocument(client, id));
    if (!resultat.ok) return resultat.response;
    return apiSuccess({ id });
  });
}
