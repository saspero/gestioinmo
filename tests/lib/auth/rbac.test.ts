import { describe, expect, it } from 'vitest';
import { can, type Accio, type Modul, type RolUsuari } from '@/lib/auth/rbac';

// Còpia independent de docs/requirements.md §2.2: si algú canvia `PERMISOS` per error, falla.
const MATRIU: Record<RolUsuari, Record<Modul, 'T' | 'L' | '-'>> = {
  admin: {
    config_tenant: 'T', propietats: 'T', propietaris: 'T', inquilins: 'T', contractes: 'T',
    pagaments: 'T', despeses: 'T', incidencies: 'T', informes: 'T',
  },
  gestor: {
    config_tenant: '-', propietats: 'T', propietaris: 'T', inquilins: 'T', contractes: 'T',
    pagaments: 'T', despeses: 'T', incidencies: 'T', informes: 'L',
  },
  comptable: {
    config_tenant: '-', propietats: 'L', propietaris: 'L', inquilins: 'L', contractes: 'L',
    pagaments: 'T', despeses: 'T', incidencies: 'L', informes: 'T',
  },
};

describe('can', () => {
  for (const [rol, moduls] of Object.entries(MATRIU) as [RolUsuari, Record<Modul, string>][]) {
    for (const [modul, nivell] of Object.entries(moduls) as [Modul, string][]) {
      const casos: [Accio, boolean][] = [
        ['lectura', nivell !== '-'],
        ['escriptura', nivell === 'T'],
      ];
      it.each(casos)(`${rol} × ${modul} × %s → %s`, (accio, esperat) => {
        expect(can(rol, modul, accio)).toBe(esperat);
      });
    }
  }
});
