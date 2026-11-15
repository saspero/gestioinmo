import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { informeAPdf } from '../../../_lib/pdf-informe';
import { apiError, apiSuccess } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { zodFieldErrors } from '../../../../../lib/validations/common';
import { avuiLocal } from '../../../../../lib/validations/contractes';
import {
  definicioInforme,
  informeACsv,
  informeIdEnum,
  informeQuerySchema,
  periodePerDefecte,
} from '../../../../../lib/validations/informes';
import { obtenirInforme } from '../../../../../lib/db/informes-llistats';

interface RouteParams {
  params: Promise<{ informe: string }>;
}

/** Un informe de la pestanya Informes, en JSON (pantalla), CSV o PDF. */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const auth = await authorize(request, 'informes', 'lectura');
    if (!auth.ok) return auth.response;

    const id = informeIdEnum.safeParse((await params).informe);
    if (!id.success) return apiError('NOT_FOUND', 'Informe no trobat.');

    const query = informeQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!query.success) {
      return apiError('VALIDATION_ERROR', 'Filtres no vàlids.', zodFieldErrors(query.error));
    }

    const definicio = definicioInforme(id.data);
    const avui = avuiLocal();
    const perDefecte = periodePerDefecte(definicio.periode, avui) ?? { dataInici: avui, dataFi: avui };
    const filtres = {
      dataInici: query.data.dataInici ?? perDefecte.dataInici,
      dataFi: query.data.dataFi ?? perDefecte.dataFi,
      propietatId: query.data.propietatId,
      propietariId: query.data.propietariId,
    };
    if (filtres.dataFi < filtres.dataInici) {
      return apiError('VALIDATION_ERROR', "La data de fi no pot ser anterior a la d'inici.");
    }

    const { resultat, noms } = await withTenantContext(auth.payload, async (client) => {
      const dades = await obtenirInforme(client, id.data, filtres, avui);
      if (query.data.format !== 'pdf') return { resultat: dades, noms: [] as string[] };
      const { rows } = await client.query<{ nom: string }>(
        `SELECT referencia || ' · ' || adreca AS nom FROM propietats WHERE id = $1
         UNION ALL
         SELECT concat_ws(' ', nom, cognoms) FROM persones WHERE id = $2`,
        [filtres.propietatId ?? null, filtres.propietariId ?? null]
      );
      return { resultat: dades, noms: rows.map((r) => r.nom) };
    });

    const fitxer = `${id.data}-${avui}`;
    if (query.data.format === 'csv') {
      return new NextResponse(informeACsv(resultat), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fitxer}.csv"`,
        },
      });
    }

    if (query.data.format === 'pdf') {
      const periode =
        definicio.periode === 'cap' ? `A dia d'avui (${avui})` : `Del ${filtres.dataInici} al ${filtres.dataFi}`;
      const subtitol = [periode, ...noms, `Generat el ${avui}`].join(' · ');
      const pdf = await informeAPdf(definicio.titol, subtitol, resultat);
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fitxer}.pdf"`,
        },
      });
    }

    return apiSuccess({ ...resultat, filtres });
  });
}
