import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { NouPropietariForm } from '@/features/propietaris/components/propietari-form';

export const metadata: Metadata = { title: 'Nou propietari · Gestinmo' };

export default async function NouPropietariPage() {
  const { allowed } = await getModuleAccess('propietaris', 'escriptura');
  if (!allowed) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nou propietari" breadcrumbs={[{ label: 'Propietaris', href: '/propietaris' }, { label: 'Nou' }]} />
      <NouPropietariForm />
    </div>
  );
}
