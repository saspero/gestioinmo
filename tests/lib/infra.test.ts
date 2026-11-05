// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger', () => {
  it('envia cada nivell al seu canal amb JSON estructurat', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logger.info('i', { tenantId: 't' });
    logger.warn('w');
    logger.error('e');

    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ level: 'info', message: 'i', tenantId: 't' });
    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({ level: 'warn' });
    expect(JSON.parse(error.mock.calls[0][0])).toMatchObject({ level: 'error' });
  });

  it('no escriu debug en producció', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logger.debug('d');
    expect(log).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe('getDomainPool', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['production', 'DATABASE_URL_PROD'],
    ['preview', 'DATABASE_URL_STAGING'],
    ['', 'DATABASE_URL_DEV'],
  ])('amb VERCEL_ENV="%s" exigeix %s', async (entorn, variable) => {
    vi.stubEnv('VERCEL_ENV', entorn);
    vi.stubEnv(variable, '');
    const { getDomainPool } = await import('@/lib/db/pool');
    expect(() => getDomainPool()).toThrow(`${variable} no configurada.`);
  });
});

describe('secrets obligatoris', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it('verifyToken no filtra la falta de JWT_SECRET com a token vàlid', async () => {
    vi.stubEnv('JWT_SECRET', '');
    const { verifyToken } = await import('@/lib/auth/jwt');
    expect(await verifyToken('qualsevol')).toBeNull();
  });
});
