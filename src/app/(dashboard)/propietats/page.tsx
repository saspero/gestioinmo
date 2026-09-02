import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { PropietatsListView } from '@/features/propietats/components/propietats-list-view';

export const metadata: Metadata = { title: 'Propietats · Gestinmo' };

export default async function PropietatsPage() {
  const { payload, allowed } = await getModuleAccess('propietats', 'lectura');
  if (!allowed) return <Forbidden />;

  const canWrite = allowed && payload.rol !== 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Propietats"
        breadcrumbs={[{ label: 'Propietats' }]}
        actions={
          canWrite && (
            <Link href="/propietats/nou" className={buttonVariants({ variant: 'default' })}>
              <Plus /> Nova propietat
            </Link>
          )
        }
      />
      <PropietatsListView />
    </div>
  );
}
