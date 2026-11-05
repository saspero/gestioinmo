// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password', () => {
  it('no desa la contrasenya en clar i la verifica', async () => {
    const hash = await hashPassword('contrasenya-de-prova');
    expect(hash).not.toContain('contrasenya-de-prova');
    expect(await verifyPassword('contrasenya-de-prova', hash)).toBe(true);
  });

  it('rebutja una contrasenya incorrecta', async () => {
    const hash = await hashPassword('contrasenya-de-prova');
    expect(await verifyPassword('una-altra', hash)).toBe(false);
  });
});
