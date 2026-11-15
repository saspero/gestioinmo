import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { definicioInforme, informeIdEnum } from '@/lib/validations/informes';
import { InformeView } from '@/features/informes/components/informe-view';

export const metadata: Metadata = { title: 'Informe · Gestinmo' };

export default async function InformePage({ params }: { params: Promise<{ informe: string }> }) {
  const { allowed } = await getModuleAccess('informes', 'lectura');
  if (!allowed) return <Forbidden />;

  const id = informeIdEnum.safeParse((await params).informe);
  if (!id.success) notFound();
  const definicio = definicioInforme(id.data);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={definicio.titol}
        description={definicio.descripcio}
        breadcrumbs={[{ label: 'Informes', href: '/informes' }, { label: definicio.titol }]}
      />
      <InformeView id={id.data} />
    </div>
  );
}
