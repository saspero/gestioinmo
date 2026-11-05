'use server';

import { isIP } from 'node:net';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyToken } from '@/lib/auth/jwt';
import { AUTH_COOKIE_NAME, login, revokeSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { loginSchema } from '@/lib/validations/auth';
import { rutaSegura } from './safe-redirect';

export interface LoginState {
  error?: string;
  fields?: { email?: string; password?: string };
  email?: string;
}

const MISSATGES = {
  invalid_credentials: 'Email o contrasenya incorrectes.',
  account_locked: "Compte bloquejat temporalment per massa intents. Torna-ho a provar d'aquí uns minuts.",
  account_disabled: "Aquest compte està desactivat. Contacta amb l'administrador de la teva agència.",
} as const;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const parsed = loginSchema.safeParse({ email, password: formData.get('password') });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { email, fields: { email: errors.email?.[0], password: errors.password?.[0] } };
  }

  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim();

  try {
    const result = await login(parsed.data.email, parsed.data.password, {
      ipAddress: ip && isIP(ip) ? ip : undefined,
      userAgent: headerStore.get('user-agent') ?? undefined,
    });

    if (!result.ok) {
      return { email, error: MISSATGES[result.reason] };
    }

    const store = await cookies();
    store.set(AUTH_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(result.payload.exp * 1000),
    });
  } catch (error) {
    logger.error('Error inesperat al login', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { email, error: "No s'ha pogut iniciar sessió. Torna-ho a provar." };
  }

  redirect(rutaSegura(formData.get('from')));
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;

  try {
    if (payload) await revokeSession(payload.jti);
  } catch (error) {
    // La cookie s'esborra igualment: l'usuari ha de poder sortir encara que falli la BD.
    logger.error("No s'ha pogut revocar la sessió", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  store.delete(AUTH_COOKIE_NAME);
  redirect('/login');
}
