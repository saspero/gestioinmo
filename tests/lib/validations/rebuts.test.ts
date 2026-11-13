import { describe, expect, it } from 'vitest';
import { concepteRebut, generarRebutsSchema } from '@/lib/validations/pagaments';

describe('rebuts del mes', () => {
  it('anomena el rebut pel mes, amb apòstrof davant de vocal', () => {
    expect(concepteRebut('2026-11')).toBe('Lloguer de novembre de 2026');
    expect(concepteRebut('2026-04')).toBe("Lloguer d'abril de 2026");
    expect(concepteRebut('2027-08')).toBe("Lloguer d'agost de 2027");
    expect(concepteRebut('2027-10')).toBe("Lloguer d'octubre de 2027");
  });

  it('només accepta un mes en format YYYY-MM', () => {
    expect(generarRebutsSchema.safeParse({ periode: '2026-11' }).success).toBe(true);
    expect(generarRebutsSchema.safeParse({ periode: '2026-13' }).success).toBe(false);
    expect(generarRebutsSchema.safeParse({ periode: '2026-11-01' }).success).toBe(false);
  });
});
