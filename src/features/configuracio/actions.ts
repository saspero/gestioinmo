'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { getDashboardSession } from '@/app/(dashboard)/_lib/session';
import { hashPassword } from '@/lib/auth/password';
import { can } from '@/lib/auth/rbac';
import { isSessionActive, revokeAllSessions } from '@/lib/auth/session';
import { BusinessRuleError } from '@/lib/db/business-error';
import { actualitzarTenantConfig, canviarEstatUsuari, crearUsuari } from '@/lib/db/usuaris';
import { logger } from '@/lib/logger';
import { zodFieldErrors } from '@/lib/validations/common';
import { actualitzarTenantSchema, crearUsuariSchema } from '@/lib/validations/configuracio';

export interface ConfigState {
  ok?: boolean;
  error?: string;
  fields?: Record<string, string>;
  /** Contrasenya temporal del nou usuari: només es retorna en aquesta resposta. */
  passwordTemporal?: string;
  emailCreat?: string;
}

const SENSE_PERMIS: ConfigState = { error: 'No tens permís per a aquesta operació.' };
const ERROR_GENERIC: ConfigState = { error: "S'ha produït un error inesperat. Torna-ho a provar més tard." };

/** Són operacions sensibles: a més del rol, es comprova que la sessió no estigui revocada. */
async function sessioAdmin() {
  const payload = await getDashboardSession();
  if (!can(payload.rol, 'config_tenant', 'escriptura')) return null;
  return (await isSessionActive(payload.jti)) ? payload : null;
}

function registrarError(context: string, error: unknown): void {
  logger.error(context, { error: error instanceof Error ? error.message : String(error) });
}

export async function guardarTenantAction(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const payload = await sessioAdmin();
  if (!payload) return SENSE_PERMIS;

  const parsed = actualitzarTenantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: zodFieldErrors(parsed.error) };

  try {
    await actualitzarTenantConfig(payload.tenant_id, parsed.data);
  } catch (error) {
    registrarError('Error en desar la configuració del tenant', error);
    return ERROR_GENERIC;
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function crearUsuariAction(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const payload = await sessioAdmin();
  if (!payload) return SENSE_PERMIS;

  const parsed = crearUsuariSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: zodFieldErrors(parsed.error) };

  const passwordTemporal = randomBytes(12).toString('base64url');

  try {
    await crearUsuari(payload.tenant_id, parsed.data, await hashPassword(passwordTemporal));
  } catch (error) {
    if (error instanceof BusinessRuleError) return { error: error.message };
    registrarError("Error en crear l'usuari", error);
    return ERROR_GENERIC;
  }

  revalidatePath('/configuracio');
  return { ok: true, passwordTemporal, emailCreat: parsed.data.email };
}

export async function canviarEstatUsuariAction(usuariId: string, actiu: boolean): Promise<ConfigState> {
  const payload = await sessioAdmin();
  if (!payload) return SENSE_PERMIS;

  if (usuariId === payload.sub) {
    return { error: 'No et pots desactivar a tu mateix.' };
  }

  try {
    const trobat = await canviarEstatUsuari(payload.tenant_id, usuariId, actiu);
    if (!trobat) return { error: 'Usuari no trobat.' };
    if (!actiu) await revokeAllSessions(usuariId);
  } catch (error) {
    registrarError("Error en canviar l'estat de l'usuari", error);
    return ERROR_GENERIC;
  }

  revalidatePath('/configuracio');
  return { ok: true };
}
