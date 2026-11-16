import type { Metadata } from 'next';

import { SollicitarRecuperacioForm } from '@/features/auth/components/recuperacio-forms';

export const metadata: Metadata = { title: 'Recupera la contrasenya · Gestinmo' };

export default function RecuperarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Recupera la contrasenya</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Escriu l&apos;email del teu compte i t&apos;hi enviarem un enllaç per triar-ne una de nova.
        </p>
        <SollicitarRecuperacioForm />
      </div>
    </main>
  );
}
