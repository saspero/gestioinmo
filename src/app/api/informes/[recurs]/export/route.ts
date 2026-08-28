import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authorize } from '../../../_lib/auth';
import { runHandler } from '../../../_lib/handler';
import { buildCsv, buildSimplePdf } from '../../../_lib/export';
import { apiError } from '../../../../../lib/errors';
import { withTenantContext } from '../../../../../lib/auth/tenant-context';
import { recursExportEnum, exportQuerySchema } from '../../../../../lib/validations/informes';
import { obtenirDadesExportacio } from '../../../../../lib/db/informes';
import type { Modul } from '../../../../../lib/auth/rbac';

interface RouteParams {
  params: Promise<{ recurs: string }>;
}

const MODUL_PER_RECURS: Record<string, Modul> = {
  propietats: 'propietats',
  propietaris: 'propietaris',
  inquilins: 'inquilins',
  contractes: 'contractes',
  pagaments: 'pagaments',
  incidencies: 'incidencies',
};

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  return runHandler(async () => {
    const { recurs } = await params;
    const recursParsed = recursExportEnum.safeParse(recurs);
    if (!recursParsed.success) {
      return apiError('VALIDATION_ERROR', "Recurs d'exportació no vàlid.");
    }

    const auth = await authorize(request, MODUL_PER_RECURS[recursParsed.data], 'lectura');
    if (!auth.ok) return auth.response;

    const queryParsed = exportQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!queryParsed.success) {
      return apiError('VALIDATION_ERROR', "Format d'exportació no vàlid (usa csv o pdf).");
    }

    const { headers, rows } = await withTenantContext(auth.payload, (client) =>
      obtenirDadesExportacio(client, recursParsed.data)
    );

    if (queryParsed.data.format === 'csv') {
      const csv = buildCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${recursParsed.data}.csv"`,
        },
      });
    }

    const pdf = buildSimplePdf(`Gestinmo — ${recursParsed.data}`, headers, rows);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${recursParsed.data}.pdf"`,
      },
    });
  });
}
