import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { verifyToken } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { LoginForm } from '@/features/auth/components/login-form';
import { rutaSegura } from '@/features/auth/safe-redirect';

export const metadata: Metadata = { title: 'Inicia sessió · Gestinmo' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; sessio?: string | string[]; restablerta?: string | string[] }>;
}) {
  const { from, sessio, restablerta } = await searchParams;
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (sessio !== 'invalida' && token && (await verifyToken(token))) {
    redirect(rutaSegura(from));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6">
        <h1 className="mb-1 text-xl font-semibold text-foreground">Gestinmo</h1>
        <p className="mb-6 text-sm text-muted-foreground">Accedeix al teu compte.</p>
        {restablerta === '1' && (
          <p role="status" className="mb-4 rounded-md bg-muted p-3 text-sm text-foreground">
            Contrasenya canviada. Ja pots iniciar sessió amb la nova.
          </p>
        )}
        <LoginForm from={typeof from === 'string' ? from : undefined} />
        <Link
          href="/recuperar"
          className="mt-4 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Has oblidat la contrasenya?
        </Link>
      </div>
    </main>
  );
}
