import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { PropietatForm } from '@/features/propietats/components/propietat-form';

export const metadata: Metadata = { title: 'Nova propietat · Gestinmo' };

export default async function NovaPropietatPage() {
  const { allowed } = await getModuleAccess('propietats', 'escriptura');
  if (!allowed) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nova propietat"
        breadcrumbs={[{ label: 'Propietats', href: '/propietats' }, { label: 'Nova' }]}
      />
      <PropietatForm />
    </div>
  );
}
