import { describe, expect, it } from 'vitest';
import {
  crearConcepteSchema,
  crearContracteSchema,
  fiDePeriode,
  properVenciment,
  sumarDies,
  sumarMesos,
} from '@/lib/validations/contractes';

const UUID = '7d1c2a50-5d6b-4b8e-9b1a-1f0e2d3c4b5a';

describe('dates del contracte', () => {
  it('suma mesos ajustant a final de mes', () => {
    expect(sumarMesos('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMesos('2024-01-31', 1)).toBe('2024-02-29');
    expect(sumarMesos('2026-11-15', 3)).toBe('2027-02-15');
    expect(sumarDies('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('el període acaba el dia abans de fer els mesos', () => {
    expect(fiDePeriode('2026-01-01', 12)).toBe('2026-12-31');
    expect(fiDePeriode('2025-03-01', 60)).toBe('2030-02-28');
  });

  const base = {
    dataInici: '2025-03-01',
    dataFi: null,
    duradaMesos: 12,
    prorrogaAutomatica: true,
    prorrogaMesos: 12,
    duradaMaximaMesos: 36,
  };

  it('calcula el venciment del període actual amb les pròrrogues', () => {
    expect(properVenciment({ ...base, prorrogaAutomatica: false }, '2027-06-01')).toBe('2026-02-28');
    expect(properVenciment(base, '2025-06-01')).toBe('2026-02-28');
    expect(properVenciment(base, '2026-06-01')).toBe('2027-02-28');
    // Amb la durada màxima esgotada, el venciment és el del límit.
    expect(properVenciment(base, '2030-01-01')).toBe('2028-02-29');
    expect(properVenciment({ ...base, duradaMaximaMesos: null }, '2030-01-01')).toBe('2030-02-28');
    expect(properVenciment({ ...base, duradaMesos: null }, '2030-01-01')).toBeNull();
    expect(properVenciment({ ...base, duradaMesos: null, dataFi: '2025-12-31' }, '2026-02-01')).toBe('2026-12-31');
  });
});

describe('alta de contracte', () => {
  const alta = { unitatId: UUID, dataInici: '2026-01-01', renda: 800, inquilinsIds: [UUID] };

  it('calcula la data de fi a partir de la durada si no se n\'indica cap', () => {
    expect(crearContracteSchema.parse({ ...alta, duradaMesos: 12 })).toMatchObject({
      dataFi: '2026-12-31',
      fianca: 800,
      tipusActualitzacio: 'ipc',
      moblat: false,
    });
    expect(crearContracteSchema.parse({ ...alta, duradaMesos: 12, dataFi: '2026-06-30' }).dataFi).toBe('2026-06-30');
  });

  it('demana el percentatge si l\'actualització és un percentatge fix', () => {
    expect(crearContracteSchema.safeParse({ ...alta, tipusActualitzacio: 'percentatge_fix' }).success).toBe(false);
    expect(
      crearContracteSchema.safeParse({ ...alta, tipusActualitzacio: 'percentatge_fix', percentatgePactat: 3 }).success
    ).toBe(true);
  });

  it('no accepta una durada màxima inferior a la inicial', () => {
    expect(crearContracteSchema.safeParse({ ...alta, duradaMesos: 60, duradaMaximaMesos: 36 }).success).toBe(false);
  });
});

describe('despeses repercutides', () => {
  const despesa = { tipus: 'escombraries', import: 120, vigentDesDe: '2026-01-01' };

  it('no admet afegir la renda com a despesa', () => {
    expect(crearConcepteSchema.safeParse({ ...despesa, tipus: 'renda' }).success).toBe(false);
  });

  it('només una despesa anual té mes de cobrament', () => {
    expect(crearConcepteSchema.safeParse({ ...despesa, periodicitat: 'anual', mesCobrament: 6 }).success).toBe(true);
    expect(crearConcepteSchema.safeParse({ ...despesa, mesCobrament: 6 }).success).toBe(false);
  });

  it('demana descripció a les despeses "altres"', () => {
    expect(crearConcepteSchema.safeParse({ ...despesa, tipus: 'altres' }).success).toBe(false);
    expect(crearConcepteSchema.safeParse({ ...despesa, tipus: 'altres', descripcio: 'Jardí' }).success).toBe(true);
  });
});
