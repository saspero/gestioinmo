import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { DashboardView } from '@/features/informes/components/dashboard-view';

export const metadata: Metadata = { title: 'Dashboard · Gestinmo' };

export default async function DashboardPage() {
  const { allowed } = await getModuleAccess('informes', 'lectura');
  if (!allowed) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Indicadors clau de l'activitat de l'agència. Per defecte, l'any en curs."
        breadcrumbs={[{ label: 'Dashboard' }]}
      />
      <DashboardView />
    </div>
  );
}
