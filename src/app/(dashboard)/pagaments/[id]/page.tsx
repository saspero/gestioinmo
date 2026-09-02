import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { PagamentDetailView } from '@/features/pagaments/components/pagament-detail-view';

export const metadata: Metadata = { title: 'Detall de rebut · Gestinmo' };

export default async function PagamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { payload, allowed } = await getModuleAccess('pagaments', 'lectura');
  if (!allowed) return <Forbidden />;

  const { id } = await params;
  const canWrite = payload.rol === 'admin' || payload.rol === 'gestor' || payload.rol === 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Detall de rebut"
        breadcrumbs={[{ label: 'Pagaments', href: '/pagaments' }, { label: 'Detall' }]}
      />
      <PagamentDetailView id={id} canWrite={canWrite} />
    </div>
  );
}
