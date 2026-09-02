import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { RemesaForm } from '@/features/pagaments/components/remesa-form';

export const metadata: Metadata = { title: 'Remeses · Gestinmo' };

export default async function RemesesPage() {
  const { allowed } = await getModuleAccess('pagaments', 'escriptura');
  if (!allowed) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Remeses"
        description="Agrupa rebuts pendents per gestionar-ne el cobrament conjuntament."
        breadcrumbs={[{ label: 'Pagaments', href: '/pagaments' }, { label: 'Remeses' }]}
      />
      <RemesaForm />
    </div>
  );
}
