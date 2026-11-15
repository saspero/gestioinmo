import { describe, expect, it } from 'vitest';
import { generarLiquidacionsSchema, importsCobrament, percentDe } from '@/lib/validations/liquidacions';

describe('liquidacions', () => {
  it('calcula percentatges arrodonits a cèntims', () => {
    expect(percentDe(1100, 60)).toBe(660);
    expect(percentDe(714, 5.5)).toBe(39.27);
    expect(percentDe(30, 21)).toBe(6.3);
  });

  it('cobra comissió només sobre la renda i hi afegeix l\'IVA', () => {
    // Rebut de 1100 € (1000 de renda + 100 d'IBI), propietari al 60 %, comissió del 5 %.
    expect(importsCobrament(1100, 1000, 60, 5)).toEqual({ import: 660, baseComissio: 600, comissio: 30, iva: 6.3 });
    expect(importsCobrament(800, 800, 100, 0)).toEqual({ import: 800, baseComissio: 800, comissio: 0, iva: 0 });
  });

  it('no accepta un període al revés', () => {
    expect(generarLiquidacionsSchema.safeParse({ periodeInici: '2026-02-01', periodeFi: '2026-01-31' }).success).toBe(
      false
    );
    expect(generarLiquidacionsSchema.safeParse({ periodeInici: '2026-01-01', periodeFi: '2026-01-31' }).success).toBe(
      true
    );
  });
});
