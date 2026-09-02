import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { buttonVariants } from '@/components/ui/button';
import { InquilinsListView } from '@/features/inquilins/components/inquilins-list-view';

export const metadata: Metadata = { title: 'Inquilins · Gestinmo' };

interface InquilinsPageProps {
  searchParams: Promise<{ estatInquili?: string }>;
}

export default async function InquilinsPage({ searchParams }: InquilinsPageProps) {
  const { payload, allowed } = await getModuleAccess('inquilins', 'lectura');
  if (!allowed) return <Forbidden />;

  const { estatInquili } = await searchParams;
  const canWrite = payload.rol !== 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inquilins"
        breadcrumbs={[{ label: 'Inquilins' }]}
        actions={
          canWrite && (
            <Link href="/inquilins/nou" className={buttonVariants({ variant: 'default' })}>
              <Plus /> Nou inquilí
            </Link>
          )
        }
      />
      <InquilinsListView estatInicial={estatInquili} />
    </div>
  );
}
