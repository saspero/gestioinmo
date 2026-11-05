import { redirect } from 'next/navigation';

import { obtenirContextUsuari } from '@/lib/db/tenants';
import { getDashboardSession } from './_lib/session';
import { DashboardShell } from './_lib/dashboard-shell';

// Resol sessió, tenant i rol una única vegada per a tot `(dashboard)`
// (docs/architecture.md §3). El menú es filtra al shell segons la matriu de permisos.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const payload = await getDashboardSession();
  const context = await obtenirContextUsuari(payload.tenant_id, payload.sub);

  // Token vàlid d'un usuari desactivat o eliminat. `sessio=invalida` impedeix que `/login`
  // el retorni aquí pel fet de tenir un JWT vàlid, cosa que crearia un bucle.
  if (!context) {
    redirect('/login?sessio=invalida');
  }

  return (
    <DashboardShell tenantName={context.tenantNom} userName={context.usuariNom} rol={payload.rol}>
      {children}
    </DashboardShell>
  );
}
