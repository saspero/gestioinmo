import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { LiquidacioDetailView } from '@/features/liquidacions/components/liquidacio-detail-view';

export const metadata: Metadata = { title: 'Liquidació · Gestinmo' };

export default async function LiquidacioPage({ params }: { params: Promise<{ id: string }> }) {
  const { payload, allowed } = await getModuleAccess('pagaments', 'lectura');
  if (!allowed) return <Forbidden />;

  const { id } = await params;
  const canWrite = payload.rol === 'admin' || payload.rol === 'gestor' || payload.rol === 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Liquidació"
        breadcrumbs={[
          { label: 'Pagaments', href: '/pagaments' },
          { label: 'Liquidacions', href: '/pagaments/liquidacions' },
          { label: 'Detall' },
        ]}
      />
      <LiquidacioDetailView id={id} canWrite={canWrite} />
    </div>
  );
}
