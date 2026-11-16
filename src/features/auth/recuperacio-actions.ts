'use server';

import { isIP } from 'node:net';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { MINUTS_VALIDESA_RECUPERACIO, restablirAmbToken, sollicitarRecuperacio } from '@/lib/auth/recuperacio';
import { enviarCorreu, urlApp } from '@/lib/email';
import { logger } from '@/lib/logger';
import { restablirContrasenyaSchema, sollicitarRecuperacioSchema } from '@/lib/validations/auth';
import { zodFieldErrors } from '@/lib/validations/common';

export interface RecuperacioState {
  enviat?: boolean;
  error?: string;
  fields?: Record<string, string>;
  email?: string;
}

function registrarError(context: string, error: unknown): void {
  logger.error(context, { error: error instanceof Error ? error.message : String(error) });
}

export async function sollicitarRecuperacioAction(
  _prev: RecuperacioState,
  formData: FormData
): Promise<RecuperacioState> {
  const email = String(formData.get('email') ?? '');
  const parsed = sollicitarRecuperacioSchema.safeParse({ email });
  if (!parsed.success) return { email, fields: zodFieldErrors(parsed.error) };

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim();
  try {
    const sollicitud = await sollicitarRecuperacio(parsed.data.email, { ipAddress: ip && isIP(ip) ? ip : undefined });
    if (sollicitud) {
      const enllac = `${urlApp()}/restablir?token=${sollicitud.token}`;
      await enviarCorreu({
        to: sollicitud.email,
        subject: 'Recupera la teva contrasenya de Gestinmo',
        text: [
          `Hola, ${sollicitud.nom}:`,
          '',
          'Algú ha demanat canviar la contrasenya del teu compte de Gestinmo. Per triar-ne una de nova, obre aquest enllaç:',
          '',
          enllac,
          '',
          `L'enllaç caduca d'aquí ${MINUTS_VALIDESA_RECUPERACIO} minuts i només es pot fer servir un cop.`,
          "Si no ho has demanat tu, ignora aquest correu: la teva contrasenya no canviarà.",
        ].join('\n'),
      });
    }
  } catch (error) {
    // La resposta és la mateixa: un error no ha de revelar si l'email existeix.
    registrarError('Error en sol·licitar la recuperació de contrasenya', error);
  }

  return { enviat: true, email: parsed.data.email };
}

export interface RestablirState {
  error?: string;
  fields?: Record<string, string>;
}

export async function restablirContrasenyaAction(_prev: RestablirState, formData: FormData): Promise<RestablirState> {
  const parsed = restablirContrasenyaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fields = zodFieldErrors(parsed.error);
    if (fields.token) return { error: fields.token };
    return { fields };
  }

  let restablerta: boolean;
  try {
    restablerta = await restablirAmbToken(parsed.data.token, parsed.data.nova);
  } catch (error) {
    registrarError('Error en restablir la contrasenya amb un enllaç', error);
    return { error: "S'ha produït un error inesperat. Torna-ho a provar més tard." };
  }
  if (!restablerta) {
    return { error: "L'enllaç ha caducat o ja s'ha fet servir. Demana'n un de nou." };
  }

  redirect('/login?restablerta=1');
}
