// Bloc 403 reutilitzat per totes les pàgines de `(dashboard)` quan `can()` denega l'accés
// (docs/ux-flows.md §4: "No tens permisos per accedir a aquesta secció." — mai s'hi arriba
// per navegació normal, només per accés directe per URL). No és un component de
// `src/components/shared/` (fora de l'scope d'aquest agent): viu dins de
// `src/app/(dashboard)/` perquè és específic de com aquest route group gestiona els 403.

import { ShieldAlert } from 'lucide-react';

export function Forbidden() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border px-6 py-12 text-center"
    >
      <ShieldAlert className="size-10 text-destructive" aria-hidden />
      <p className="text-sm font-medium text-foreground">No tens permisos per accedir a aquesta secció.</p>
    </div>
  );
}
