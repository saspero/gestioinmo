import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { DespesesListView } from '@/features/despeses/components/despeses-list-view';

export const metadata: Metadata = { title: 'Despeses · Gestinmo' };

export default async function DespesesPage() {
  const { allowed } = await getModuleAccess('despeses', 'lectura');
  if (!allowed) return <Forbidden />;

  const { allowed: canWrite } = await getModuleAccess('despeses', 'escriptura');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Despeses"
        breadcrumbs={[{ label: 'Despeses' }]}
        actions={
          canWrite && (
            <Link href="/despeses/nou" className={buttonVariants({ variant: 'default' })}>
              <Plus /> Nova despesa
            </Link>
          )
        }
      />
      <DespesesListView />
    </div>
  );
}
