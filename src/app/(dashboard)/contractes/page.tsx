import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { ContractesListView } from '@/features/contractes/components/contractes-list-view';

export const metadata: Metadata = { title: 'Contractes · Gestinmo' };

export default async function ContractesPage() {
  const { payload, allowed } = await getModuleAccess('contractes', 'lectura');
  if (!allowed) return <Forbidden />;

  const canWrite = payload.rol !== 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contractes"
        breadcrumbs={[{ label: 'Contractes' }]}
        actions={
          canWrite && (
            <Link href="/contractes/nou" className={buttonVariants({ variant: 'default' })}>
              <Plus /> Nou contracte
            </Link>
          )
        }
      />
      <ContractesListView />
    </div>
  );
}
