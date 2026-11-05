import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { llistarUsuaris, obtenirTenantConfig } from '@/lib/db/usuaris';
import { ConfiguracioView } from '@/features/configuracio/components/configuracio-view';

export const metadata: Metadata = { title: 'Configuració · Gestinmo' };

export default async function ConfiguracioPage() {
  const { payload, allowed } = await getModuleAccess('config_tenant', 'lectura');
  if (!allowed) return <Forbidden />;

  const [tenant, usuaris] = await Promise.all([
    obtenirTenantConfig(payload.tenant_id),
    llistarUsuaris(payload.tenant_id),
  ]);
  if (!tenant) return <Forbidden />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configuració" breadcrumbs={[{ label: 'Configuració' }]} />
      <ConfiguracioView tenant={tenant} usuaris={usuaris} usuariActualId={payload.sub} />
    </div>
  );
}
