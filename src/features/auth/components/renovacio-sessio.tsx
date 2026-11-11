'use client';

import { useEffect } from 'react';

import { renovarSessioAction } from '../actions';

/** Com a molt una comprovació per minut, per molta activitat que hi hagi. */
const INTERVAL_MINIM_MS = 60_000;
const ESDEVENIMENTS_ACTIVITAT = ['pointerdown', 'keydown'] as const;

/**
 * Renovació lliscant de la sessió: mentre l'usuari fa servir l'aplicació, demana al
 * servidor que allargui la sessió; si l'usuari no hi toca, caduca com sempre. No
 * pinta res.
 */
export function RenovacioSessio() {
  useEffect(() => {
    let darrera = 0;
    let enCurs = false;

    async function comprovar() {
      const ara = Date.now();
      if (enCurs || ara - darrera < INTERVAL_MINIM_MS) return;
      darrera = ara;
      enCurs = true;
      try {
        if ((await renovarSessioAction()) === 'caducada') {
          window.location.assign('/login');
        }
      } catch {
        // Error de xarxa: es tornarà a provar amb la propera activitat.
      } finally {
        enCurs = false;
      }
    }

    for (const esdeveniment of ESDEVENIMENTS_ACTIVITAT) {
      window.addEventListener(esdeveniment, comprovar, { passive: true });
    }
    void comprovar();

    return () => {
      for (const esdeveniment of ESDEVENIMENTS_ACTIVITAT) {
        window.removeEventListener(esdeveniment, comprovar);
      }
    };
  }, []);

  return null;
}
