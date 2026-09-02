import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { InquiliForm } from '@/features/inquilins/components/inquili-form';

export const metadata: Metadata = { title: 'Nou inquilí · Gestinmo' };

export default async function NouInquiliPage() {
  const { allowed } = await getModuleAccess('inquilins', 'escriptura');
  if (!allowed) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nou inquilí" breadcrumbs={[{ label: 'Inquilins', href: '/inquilins' }, { label: 'Nou' }]} />
      <InquiliForm />
    </div>
  );
}
