import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { DespesaForm } from '@/features/despeses/components/despesa-form';

export const metadata: Metadata = { title: 'Nova despesa · Gestinmo' };

interface NovaDespesaPageProps {
  searchParams: Promise<{ propietatId?: string }>;
}

export default async function NovaDespesaPage({ searchParams }: NovaDespesaPageProps) {
  const { allowed } = await getModuleAccess('despeses', 'escriptura');
  if (!allowed) return <Forbidden />;

  const { propietatId } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nova despesa" breadcrumbs={[{ label: 'Despeses', href: '/despeses' }, { label: 'Nova' }]} />
      <DespesaForm propietatIdInicial={propietatId} />
    </div>
  );
}
