import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { can } from '@/lib/auth/rbac';
import { PropietarisListView } from '@/features/propietaris/components/propietaris-list-view';

export const metadata: Metadata = { title: 'Propietaris · Gestinmo' };

export default async function PropietarisPage() {
  const { payload, allowed } = await getModuleAccess('propietaris', 'lectura');
  if (!allowed) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Propietaris"
        breadcrumbs={[{ label: 'Propietaris' }]}
        actions={
          can(payload.rol, 'propietaris', 'escriptura') && (
            <Link href="/propietaris/nou" className={buttonVariants({ variant: 'default' })}>
              <Plus /> Nou propietari
            </Link>
          )
        }
      />
      <PropietarisListView />
    </div>
  );
}
