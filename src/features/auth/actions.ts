'use server';

import { isIP } from 'node:net';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getDashboardSession } from '@/app/(dashboard)/_lib/session';
import { necessitaRenovacio, verifyToken } from '@/lib/auth/jwt';
import {
  AUTH_COOKIE_NAME,
  canviarContrasenya,
  isSessionActive,
  login,
  reemetreSessio,
  renovarSessio,
  revokeSession,
  type LoginMeta,
} from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { canviContrasenyaSchema, loginSchema } from '@/lib/validations/auth';
import { zodFieldErrors } from '@/lib/validations/common';
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

async function metaPeticio(): Promise<LoginMeta> {
  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    ipAddress: ip && isIP(ip) ? ip : undefined,
    userAgent: headerStore.get('user-agent') ?? undefined,
  };
}

async function desarCookieSessio(token: string, expires: Date): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const parsed = loginSchema.safeParse({ email, password: formData.get('password') });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return { email, fields: { email: errors.email?.[0], password: errors.password?.[0] } };
  }

  try {
    const result = await login(parsed.data.email, parsed.data.password, await metaPeticio());

    if (!result.ok) {
      return { email, error: MISSATGES[result.reason] };
    }

    await desarCookieSessio(result.token, new Date(result.payload.exp * 1000));
  } catch (error) {
    logger.error('Error inesperat al login', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { email, error: "No s'ha pogut iniciar sessió. Torna-ho a provar." };
  }

  redirect(rutaSegura(formData.get('from')));
}

export interface CanviContrasenyaState {
  ok?: boolean;
  error?: string;
  fields?: Record<string, string>;
}

const MISSATGES_CANVI = {
  contrasenya_incorrecta: 'La contrasenya actual no és correcta.',
  compte_bloquejat: MISSATGES.account_locked,
  usuari_no_trobat: 'La teva sessió ja no és vàlida. Torna a iniciar sessió.',
} as const;

export async function canviarContrasenyaAction(
  _prev: CanviContrasenyaState,
  formData: FormData
): Promise<CanviContrasenyaState> {
  const payload = await getDashboardSession();
  if (!(await isSessionActive(payload.jti))) return { error: MISSATGES_CANVI.usuari_no_trobat };

  const parsed = canviContrasenyaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: zodFieldErrors(parsed.error) };

  try {
    const result = await canviarContrasenya(payload.sub, parsed.data.actual, parsed.data.nova, payload.jti);
    if (result !== 'ok') return { error: MISSATGES_CANVI[result] };

    if (payload.canvi_contrasenya) {
      const sessio = await reemetreSessio(payload, await metaPeticio());
      await desarCookieSessio(sessio.token, sessio.expiresAt);
    }
  } catch (error) {
    logger.error('Error en canviar la contrasenya', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: "No s'ha pogut canviar la contrasenya. Torna-ho a provar." };
  }

  // Era la contrasenya temporal: ja pot fer servir l'aplicació.
  if (payload.canvi_contrasenya) redirect('/');
  return { ok: true };
}

export type RenovacioSessio = 'vigent' | 'renovada' | 'caducada';

/**
 * La crida el client quan hi ha activitat. Només toca la BD quan ha passat més de la
 * meitat de la vida del token; si la sessió s'ha revocat o l'usuari s'ha desactivat,
 * esborra la cookie i respon `caducada` perquè el client torni al login.
 */
export async function renovarSessioAction(): Promise<RenovacioSessio> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return 'caducada';
  if (!necessitaRenovacio(payload)) return 'vigent';

  try {
    const nova = await renovarSessio(payload);
    if (!nova) {
      store.delete(AUTH_COOKIE_NAME);
      return 'caducada';
    }
    await desarCookieSessio(nova.token, nova.expiresAt);
    return 'renovada';
  } catch (error) {
    // Un error puntual no ha de treure l'usuari: el token actual encara és vàlid.
    logger.error("No s'ha pogut renovar la sessió", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'vigent';
  }
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
