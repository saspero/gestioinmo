// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildLimitOffsetClause, buildMeta, buildOrderByClause } from '@/lib/db/pagination';
import { translatePgError } from '@/lib/db/pg-error';
import { apiError, apiSuccess } from '@/lib/errors';

describe('paginació', () => {
  it('parametritza LIMIT i OFFSET', () => {
    expect(buildLimitOffsetClause({ page: 3, pageSize: 20 }, 4)).toEqual({
      clause: 'LIMIT $4 OFFSET $5',
      values: [20, 40],
    });
  });

  it('només ordena per columnes de la llista blanca', () => {
    expect(buildOrderByClause({ sort: 'nom', order: 'desc' }, ['nom'], 'id')).toBe('ORDER BY nom DESC');
    expect(buildOrderByClause({ sort: 'nom; DROP TABLE x', order: 'asc' }, ['nom'], 'id')).toBe('ORDER BY id ASC');
  });

  it('construeix la meta', () => {
    expect(buildMeta({ page: 1, pageSize: 20 }, 7)).toEqual({ page: 1, pageSize: 20, total: 7 });
  });
});

describe('translatePgError', () => {
  it('tradueix un constraint conegut', () => {
    expect(translatePgError({ code: '23505', constraint: 'persones_nif_hash_actiu_unique' })).toContain('NIF/CIF');
  });

  it('usa un missatge genèric per a un constraint desconegut', () => {
    expect(translatePgError({ code: '23505', constraint: 'altre' })).toContain('regla de negoci');
  });

  it('deixa passar el missatge dels triggers de negoci', () => {
    expect(translatePgError({ code: 'P0001', message: 'Regla incomplerta' })).toBe('Regla incomplerta');
  });

  it('no exposa errors desconeguts', () => {
    expect(translatePgError({ code: '42601', message: 'syntax error' })).toBeNull();
    expect(translatePgError(new Error('sense codi'))).toBeNull();
  });
});

describe('envelope API', () => {
  it('retorna data i meta', async () => {
    const res = apiSuccess({ id: 1 }, { page: 1, pageSize: 20, total: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: 1 }, meta: { page: 1, pageSize: 20, total: 1 } });
  });

  it("mapeja cada codi d'error al seu estat HTTP", async () => {
    const res = apiError('CONFLICT', 'Conflicte', { camp: 'error' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'CONFLICT', message: 'Conflicte', fields: { camp: 'error' } } });
  });
});
