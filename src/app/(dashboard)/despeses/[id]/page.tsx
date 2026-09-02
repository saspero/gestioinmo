import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { DespesaDetailView } from '@/features/despeses/components/despesa-detail-view';

export const metadata: Metadata = { title: 'Detall de despesa · Gestinmo' };

export default async function DespesaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await getModuleAccess('despeses', 'lectura');
  if (!allowed) return <Forbidden />;

  const { id } = await params;
  const { allowed: canWrite } = await getModuleAccess('despeses', 'escriptura');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Detall de despesa"
        breadcrumbs={[{ label: 'Despeses', href: '/despeses' }, { label: 'Detall' }]}
      />
      <DespesaDetailView id={id} canWrite={canWrite} />
    </div>
  );
}
