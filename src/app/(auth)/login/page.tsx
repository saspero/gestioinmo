import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyToken } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { LoginForm } from '@/features/auth/components/login-form';
import { rutaSegura } from '@/features/auth/safe-redirect';

export const metadata: Metadata = { title: 'Inicia sessió · Gestinmo' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[]; sessio?: string | string[] }>;
}) {
  const { from, sessio } = await searchParams;
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
        <LoginForm from={typeof from === 'string' ? from : undefined} />
      </div>
    </main>
  );
}
