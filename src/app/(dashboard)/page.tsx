import { redirect } from 'next/navigation';

import { RUTA_PER_DEFECTE } from '@/features/auth/safe-redirect';

// `/dashboard` és la pantalla d'inici (docs/ux-flows.md §3.1).
export default function DashboardRootPage() {
  redirect(RUTA_PER_DEFECTE);
}
