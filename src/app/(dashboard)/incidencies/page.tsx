import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { IncidenciesListView } from '@/features/incidencies/components/incidencies-list-view';

export const metadata: Metadata = { title: 'Incidències · Gestinmo' };

interface IncidenciesPageProps {
  searchParams: Promise<{ estat?: string }>;
}

export default async function IncidenciesPage({ searchParams }: IncidenciesPageProps) {
  const { payload, allowed } = await getModuleAccess('incidencies', 'lectura');
  if (!allowed) return <Forbidden />;

  const { estat } = await searchParams;
  const canWrite = payload.rol !== 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Incidències"
        breadcrumbs={[{ label: 'Incidències' }]}
        actions={
          canWrite && (
            <Link href="/incidencies/nou" className={buttonVariants({ variant: 'default' })}>
              <Plus /> Nova incidència
            </Link>
          )
        }
      />
      <IncidenciesListView estatInicial={estat} />
    </div>
  );
}
