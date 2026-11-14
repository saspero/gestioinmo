import { describe, expect, it } from 'vitest';
import {
  aniversariDesDe,
  avisosContracte,
  avuiLocal,
  rendaActualitzada,
  type ContractePerAvisos,
} from '@/lib/validations/contractes';

const base: ContractePerAvisos = {
  estat: 'actiu',
  dataInici: '2025-03-01',
  dataFi: null,
  duradaMesos: 60,
  prorrogaAutomatica: true,
  prorrogaMesos: 12,
  duradaMaximaMesos: null,
  preavisDies: null,
  tipusActualitzacio: 'percentatge_fix',
  percentatgePactat: '2.00',
  renda: '700.00',
  darrerCanviRenda: '2025-03-01',
};

describe('actualització de la renda', () => {
  it('calcula la renda nova arrodonida a cèntims', () => {
    expect(rendaActualitzada(700, 2)).toBe(714);
    expect(rendaActualitzada(650, 2.8)).toBe(668.2);
  });

  it('troba el proper aniversari', () => {
    expect(aniversariDesDe('2025-03-01', '2026-01-10')).toBe('2026-03-01');
    expect(aniversariDesDe('2025-03-01', '2026-03-02')).toBe('2027-03-01');
    expect(aniversariDesDe('2024-02-29', '2025-01-01')).toBe('2025-02-28');
  });

  it('avisa 60 dies abans de l\'aniversari amb la renda proposada', () => {
    expect(avisosContracte(base, '2026-01-10')).toEqual([
      { tipus: 'actualitzacio', aniversari: '2026-03-01', rendaActual: 700, percentatge: 2, rendaProposada: 714 },
    ]);
    expect(avisosContracte(base, '2025-12-15')).toEqual([]);
  });

  it('continua avisant 30 dies després si no s\'ha aplicat, i calla un cop aplicada', () => {
    expect(avisosContracte(base, '2026-03-20')).toHaveLength(1);
    expect(avisosContracte(base, '2026-04-05')).toEqual([]);
    expect(avisosContracte({ ...base, darrerCanviRenda: '2026-03-01' }, '2026-01-10')).toEqual([]);
  });

  it('no proposa import si depèn de l\'IPC, i no avisa si no hi ha actualització', () => {
    expect(avisosContracte({ ...base, tipusActualitzacio: 'ipc', percentatgePactat: null }, '2026-01-10')).toMatchObject([
      { tipus: 'actualitzacio', percentatge: null, rendaProposada: null },
    ]);
    expect(avisosContracte({ ...base, tipusActualitzacio: 'cap' }, '2026-01-10')).toEqual([]);
    expect(avisosContracte({ ...base, estat: 'esborrany' }, '2026-01-10')).toEqual([]);
  });
});

describe('termini per no renovar', () => {
  const anual = { ...base, duradaMesos: 12, tipusActualitzacio: 'cap' };

  it('sense preavís pactat, usa els 120 dies del propietari i avisa 30 dies abans del límit', () => {
    expect(avisosContracte(anual, '2025-09-15')).toEqual([]);
    expect(avisosContracte(anual, '2025-10-15')).toEqual([
      {
        tipus: 'no_renovacio',
        venciment: '2026-02-28',
        limit: '2025-10-31',
        preavisDies: 120,
        preavisPerDefecte: true,
        prorrogaAutomatica: true,
      },
    ]);
  });

  it('usa el preavís pactat i continua avisant fins al venciment', () => {
    const pactat = { ...anual, preavisDies: 30 };
    expect(avisosContracte(pactat, '2025-12-15')).toEqual([]);
    expect(avisosContracte(pactat, '2026-02-10')).toMatchObject([
      { tipus: 'no_renovacio', limit: '2026-01-29', preavisPerDefecte: false },
    ]);
  });

  it('dona la data d\'avui a l\'hora peninsular', () => {
    expect(avuiLocal(new Date('2026-11-13T23:30:00Z'))).toBe('2026-11-14');
  });
});
