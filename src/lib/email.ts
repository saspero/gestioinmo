// Enviament de correus. Amb `RESEND_API_KEY` i `EMAIL_FROM` configurats, s'envien amb
// l'API de Resend. Sense, el correu s'escriu al registre del servidor (Vercel › Logs)
// perquè l'administrador el pugui fer arribar a mà mentre no hi ha servei de correu.

import { logger } from './logger';

export interface Correu {
  to: string;
  subject: string;
  text: string;
}

export function correuConfigurat(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function enviarCorreu(correu: Correu): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    logger.warn('Correu no enviat: falta configurar RESEND_API_KEY i EMAIL_FROM', {
      to: correu.to,
      subject: correu.subject,
      text: correu.text,
    });
    return;
  }

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [correu.to], subject: correu.subject, text: correu.text }),
  });
  if (!resposta.ok) {
    throw new Error(`Resend ha respost ${resposta.status}`);
  }
}

/**
 * Adreça pública de l'app per als enllaços dels correus. Mai es treu de la petició
 * (capçalera Host): un atacant hi podria posar el seu domini i rebre el token.
 */
export function urlApp(): string {
  const configurada = process.env.NEXT_PUBLIC_APP_URL;
  if (configurada) return configurada.replace(/\/+$/, '');
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
