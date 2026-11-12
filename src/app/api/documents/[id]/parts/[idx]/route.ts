import { NextResponse, type NextRequest } from 'next/server';
import { runHandler } from '../../../../_lib/handler';
import { apiError, apiSuccess } from '../../../../../../lib/errors';
import { desarPartDocument, llegirPartDocument } from '../../../../../../lib/db/documents';
import { midaPartDocument, MIDA_PART_DOCUMENT } from '../../../../../../lib/validations/documents';
import { ambDocument } from '../../../acces';

interface RouteParams {
  params: Promise<{ id: string; idx: string }>;
}

function index(idx: string): number | null {
  return /^\d{1,4}$/.test(idx) ? Number(idx) : null;
}

/** Puja un tros del fitxer, en binari (`application/octet-stream`). */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const { id, idx } = await params;
    const n = index(idx);
    if (n === null) return apiError('NOT_FOUND', 'Tros no trobat.');

    // Es rebutja abans de llegir el cos si ja s'anuncia massa gran.
    const anunciada = Number(request.headers.get('content-length') ?? '0');
    if (anunciada > MIDA_PART_DOCUMENT) return apiError('VALIDATION_ERROR', 'El tros és massa gran.');

    const dades = Buffer.from(await request.arrayBuffer());
    const resultat = await ambDocument(request, id, 'escriptura', async (client, document) => {
      if (document.complet) return 'complet' as const;
      if (n >= document.parts || dades.length !== midaPartDocument(document.mida, n)) return 'mida' as const;
      await desarPartDocument(client, id, n, dades);
      return 'ok' as const;
    });
    if (!resultat.ok) return resultat.response;
    if (resultat.valor === 'complet') return apiError('CONFLICT', 'Aquest document ja està complet.');
    if (resultat.valor === 'mida') return apiError('VALIDATION_ERROR', 'El tros no té la mida esperada.');
    return apiSuccess({ idx: n });
  });
}

/** Descarrega un tros del fitxer, en binari. */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const { id, idx } = await params;
    const n = index(idx);
    if (n === null) return apiError('NOT_FOUND', 'Tros no trobat.');

    const resultat = await ambDocument(request, id, 'lectura', (client, document) =>
      document.complet ? llegirPartDocument(client, id, n) : Promise.resolve(null)
    );
    if (!resultat.ok) return resultat.response;
    if (!resultat.valor) return apiError('NOT_FOUND', 'Tros no trobat.');

    return new NextResponse(new Uint8Array(resultat.valor), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}
