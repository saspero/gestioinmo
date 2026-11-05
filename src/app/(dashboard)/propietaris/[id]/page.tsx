import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { can } from '@/lib/auth/rbac';
import { PropietariDetailView } from '@/features/propietaris/components/propietari-detail-view';

export const metadata: Metadata = { title: 'Detall de propietari · Gestinmo' };

export default async function PropietariDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { payload, allowed } = await getModuleAccess('propietaris', 'lectura');
  if (!allowed) return <Forbidden />;

  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Detall de propietari"
        breadcrumbs={[{ label: 'Propietaris', href: '/propietaris' }, { label: 'Detall' }]}
      />
      <PropietariDetailView id={id} canWrite={can(payload.rol, 'propietaris', 'escriptura')} />
    </div>
  );
}
