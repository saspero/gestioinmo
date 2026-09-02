import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { PropietatDetailView } from '@/features/propietats/components/propietat-detail-view';

export const metadata: Metadata = { title: 'Detall de propietat · Gestinmo' };

export default async function PropietatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { payload, allowed } = await getModuleAccess('propietats', 'lectura');
  if (!allowed) return <Forbidden />;

  const { id } = await params;
  const canWrite = payload.rol !== 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Detall de propietat"
        breadcrumbs={[{ label: 'Propietats', href: '/propietats' }, { label: 'Detall' }]}
      />
      <PropietatDetailView id={id} canWrite={canWrite} />
    </div>
  );
}
