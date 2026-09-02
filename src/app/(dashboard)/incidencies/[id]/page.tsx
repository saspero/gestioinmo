import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { IncidenciaDetailView } from '@/features/incidencies/components/incidencia-detail-view';

export const metadata: Metadata = { title: 'Detall d\'incidència · Gestinmo' };

export default async function IncidenciaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { payload, allowed } = await getModuleAccess('incidencies', 'lectura');
  if (!allowed) return <Forbidden />;

  const { id } = await params;
  const canWrite = payload.rol !== 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Detall d'incidència"
        breadcrumbs={[{ label: 'Incidències', href: '/incidencies' }, { label: 'Detall' }]}
      />
      <IncidenciaDetailView id={id} canWrite={canWrite} canReadCost />
    </div>
  );
}
