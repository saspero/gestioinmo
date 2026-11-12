import { describe, expect, it } from 'vitest';
import { anyEnCurs, periodeDashboard } from '@/features/informes/periode';

const ARA = new Date(2026, 10, 12); // 12 de novembre de 2026, hora local

describe('període del dashboard', () => {
  it("per defecte és l'any en curs", () => {
    expect(anyEnCurs(ARA)).toEqual({ inici: '2026-01-01', fi: '2026-12-31' });
    expect(periodeDashboard('', '', ARA)).toEqual({ dataInici: '2026-01-01', dataFi: '2026-12-31' });
  });

  it("respecta les dates triades i completa la que falti amb l'any en curs", () => {
    expect(periodeDashboard('2025-03-01', '2025-06-30', ARA)).toEqual({ dataInici: '2025-03-01', dataFi: '2025-06-30' });
    expect(periodeDashboard('2026-05-01', '', ARA)).toEqual({ dataInici: '2026-05-01', dataFi: '2026-12-31' });
    expect(periodeDashboard('', '2026-03-31', ARA)).toEqual({ dataInici: '2026-01-01', dataFi: '2026-03-31' });
  });
});
