import type { Metadata } from 'next';
import Link from 'next/link';

import { RestablirContrasenyaForm } from '@/features/auth/components/recuperacio-forms';
import { tokenRecuperacioVigent } from '@/lib/auth/recuperacio';
import { restablirContrasenyaSchema } from '@/lib/validations/auth';

export const metadata: Metadata = { title: 'Contrasenya nova · Gestinmo', referrer: 'no-referrer' };

export default async function RestablirPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const valid =
    typeof token === 'string' &&
    restablirContrasenyaSchema.shape.token.safeParse(token).success &&
    (await tokenRecuperacioVigent(token));

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Contrasenya nova</h1>
        {valid ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              Tria la contrasenya nova. Es tancaran totes les sessions obertes del teu compte.
            </p>
            <RestablirContrasenyaForm token={token} />
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <p role="alert" className="text-sm text-foreground">
              Aquest enllaç ha caducat o ja s&apos;ha fet servir.
            </p>
            <Link href="/recuperar" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Demana&apos;n un de nou
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
