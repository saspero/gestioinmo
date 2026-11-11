import type { Metadata } from 'next';

import { PageHeader } from '@/components/shared';
import { CanviContrasenyaForm } from '@/features/auth/components/canvi-contrasenya-form';
import { getDashboardSession } from '../_lib/session';

export const metadata: Metadata = { title: 'El meu compte · Gestinmo' };

// Disponible per a tots els rols: cada usuari gestiona la seva pròpia contrasenya.
export default async function ComptePage() {
  await getDashboardSession();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="El meu compte" breadcrumbs={[{ label: 'El meu compte' }]} />
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">Canviar contrasenya</h2>
        <CanviContrasenyaForm />
      </section>
    </div>
  );
}
