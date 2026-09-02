import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { ContracteDetailView } from '@/features/contractes/components/contracte-detail-view';

export const metadata: Metadata = { title: 'Detall de contracte · Gestinmo' };

export default async function ContracteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { payload, allowed } = await getModuleAccess('contractes', 'lectura');
  if (!allowed) return <Forbidden />;

  const { id } = await params;
  const canWrite = payload.rol !== 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Detall de contracte"
        breadcrumbs={[{ label: 'Contractes', href: '/contractes' }, { label: 'Detall' }]}
      />
      <ContracteDetailView id={id} canWrite={canWrite} />
    </div>
  );
}
