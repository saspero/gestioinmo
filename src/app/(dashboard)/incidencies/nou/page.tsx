import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { IncidenciaForm } from '@/features/incidencies/components/incidencia-form';

export const metadata: Metadata = { title: 'Nova incidència · Gestinmo' };

interface NovaIncidenciaPageProps {
  searchParams: Promise<{ propietatId?: string; unitatId?: string; contracteId?: string }>;
}

export default async function NovaIncidenciaPage({ searchParams }: NovaIncidenciaPageProps) {
  const { allowed } = await getModuleAccess('incidencies', 'escriptura');
  if (!allowed) return <Forbidden />;

  const { propietatId, unitatId, contracteId } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nova incidència"
        breadcrumbs={[{ label: 'Incidències', href: '/incidencies' }, { label: 'Nova' }]}
      />
      <IncidenciaForm propietatIdInicial={propietatId} unitatIdInicial={unitatId} contracteIdInicial={contracteId} />
    </div>
  );
}
