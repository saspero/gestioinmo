import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashToken } from '@/lib/auth/recuperacio';
import { urlApp } from '@/lib/email';
import { restablirContrasenyaSchema, sollicitarRecuperacioSchema } from '@/lib/validations/auth';

const TOKEN = 'a'.repeat(43);

describe('recuperació de contrasenya', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('desa un hash que no és el token', () => {
    expect(hashToken(TOKEN)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(TOKEN)).not.toContain(TOKEN);
  });

  it("normalitza l'email", () => {
    expect(sollicitarRecuperacioSchema.parse({ email: ' Anna@Exemple.CAT ' })).toEqual({ email: 'anna@exemple.cat' });
  });

  it('valida el token i la contrasenya nova', () => {
    expect(restablirContrasenyaSchema.safeParse({ token: TOKEN, nova: 'prou-llarga', confirmacio: 'prou-llarga' }).success).toBe(true);
    expect(restablirContrasenyaSchema.safeParse({ token: 'curt', nova: 'prou-llarga', confirmacio: 'prou-llarga' }).success).toBe(false);
    expect(restablirContrasenyaSchema.safeParse({ token: TOKEN, nova: 'curta', confirmacio: 'curta' }).success).toBe(false);
    expect(restablirContrasenyaSchema.safeParse({ token: TOKEN, nova: 'prou-llarga', confirmacio: 'una-altra' }).success).toBe(false);
  });

  it("treu l'adreça dels enllaços de la configuració, mai de la petició", () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'gestioinmo.vercel.app');
    vi.stubEnv('VERCEL_URL', 'gestioinmo-abc123.vercel.app');
    expect(urlApp()).toBe('https://gestioinmo.vercel.app');

    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(urlApp()).toBe('https://gestioinmo-abc123.vercel.app');

    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.exemple.cat/');
    expect(urlApp()).toBe('https://app.exemple.cat');
  });
});
