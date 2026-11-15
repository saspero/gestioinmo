import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { LiquidacionsListView } from '@/features/liquidacions/components/liquidacions-list-view';
import { GenerarLiquidacionsButton } from '@/features/liquidacions/components/generar-liquidacions-button';

export const metadata: Metadata = { title: 'Liquidacions · Gestinmo' };

export default async function LiquidacionsPage() {
  const { payload, allowed } = await getModuleAccess('pagaments', 'lectura');
  if (!allowed) return <Forbidden />;

  const canWrite = payload.rol === 'admin' || payload.rol === 'gestor' || payload.rol === 'comptable';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Liquidacions als propietaris"
        description="El que es cobra de cada propietari, menys les seves despeses i la comissió de l'agència."
        breadcrumbs={[{ label: 'Pagaments', href: '/pagaments' }, { label: 'Liquidacions' }]}
        actions={canWrite && <GenerarLiquidacionsButton />}
      />
      <LiquidacionsListView />
    </div>
  );
}
