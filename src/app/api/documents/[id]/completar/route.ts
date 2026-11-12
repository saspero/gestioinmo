import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import { runHandler } from '../../../_lib/handler';
import { apiSuccess } from '../../../../../lib/errors';
import { completarDocument } from '../../../../../lib/db/documents';
import { ambDocument } from '../../acces';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Tanca la pujada quan ja han arribat tots els trossos. */
export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const { id } = await params;
    const resultat = await ambDocument(request, id, 'escriptura', (client) => completarDocument(client, id));
    if (!resultat.ok) return resultat.response;
    return apiSuccess(resultat.valor);
  });
}
