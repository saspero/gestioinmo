import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { ContracteWizard } from '@/features/contractes/components/contracte-wizard';

export const metadata: Metadata = { title: 'Nou contracte · Gestinmo' };

interface NouContractePageProps {
  searchParams: Promise<{ unitatId?: string; propietatId?: string }>;
}

export default async function NouContractePage({ searchParams }: NouContractePageProps) {
  const { allowed } = await getModuleAccess('contractes', 'escriptura');
  if (!allowed) return <Forbidden />;

  const { unitatId, propietatId } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nou contracte" breadcrumbs={[{ label: 'Contractes', href: '/contractes' }, { label: 'Nou' }]} />
      <ContracteWizard unitatIdInicial={unitatId} propietatIdInicial={propietatId} />
    </div>
  );
}
