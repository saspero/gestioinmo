import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { InquiliDetailView } from '@/features/inquilins/components/inquili-detail-view';

export const metadata: Metadata = { title: 'Detall d\'inquilí · Gestinmo' };

export default async function InquiliDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { payload, allowed } = await getModuleAccess('inquilins', 'lectura');
  if (!allowed) return <Forbidden />;

  const { id } = await params;
  const canWrite = payload.rol !== 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Detall d'inquilí"
        breadcrumbs={[{ label: 'Inquilins', href: '/inquilins' }, { label: 'Detall' }]}
      />
      <InquiliDetailView id={id} canWrite={canWrite} />
    </div>
  );
}
