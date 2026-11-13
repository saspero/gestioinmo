import Link from 'next/link';
import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { PagamentsListView } from '@/features/pagaments/components/pagaments-list-view';
import { GenerarRebutsButton } from '@/features/pagaments/components/generar-rebuts-button';

export const metadata: Metadata = { title: 'Pagaments · Gestinmo' };

interface PagamentsPageProps {
  searchParams: Promise<{ estat?: string }>;
}

export default async function PagamentsPage({ searchParams }: PagamentsPageProps) {
  const { payload, allowed } = await getModuleAccess('pagaments', 'lectura');
  if (!allowed) return <Forbidden />;

  const { estat } = await searchParams;
  const canWrite = payload.rol === 'admin' || payload.rol === 'gestor' || payload.rol === 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pagaments"
        breadcrumbs={[{ label: 'Pagaments' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/pagaments/remeses" className={buttonVariants({ variant: 'outline' })}>
              Remeses
            </Link>
            {canWrite && <GenerarRebutsButton />}
          </div>
        }
      />
      <PagamentsListView estatInicial={estat} />
    </div>
  );
}
