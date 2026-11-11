// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { signToken } from '@/lib/auth/jwt';
import { middleware } from '@/middleware';

const USUARI = {
  sub: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  rol: 'gestor' as const,
  jti: '33333333-3333-4333-8333-333333333333',
};

async function peticio(ruta: string, canviContrasenya: boolean): Promise<NextRequest> {
  const token = await signToken({ ...USUARI, ...(canviContrasenya ? { canvi_contrasenya: true as const } : {}) }, 60);
  return new NextRequest(`https://app.test${ruta}`, { headers: { cookie: `gestinmo_session=${token}` } });
}

describe('middleware amb contrasenya temporal', () => {
  it('desvia qualsevol pàgina a "El meu compte"', async () => {
    const resposta = await middleware(await peticio('/propietats', true));
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get('location')).toBe('https://app.test/compte');
  });

  it('deixa passar "El meu compte"', async () => {
    const resposta = await middleware(await peticio('/compte', true));
    expect(resposta.headers.get('location')).toBeNull();
    expect(resposta.status).toBe(200);
  });

  it("respon 403 a l'API", async () => {
    const resposta = await middleware(await peticio('/api/propietats', true));
    expect(resposta.status).toBe(403);
  });

  it('no afecta les sessions normals', async () => {
    const resposta = await middleware(await peticio('/propietats', false));
    expect(resposta.headers.get('location')).toBeNull();
  });
});
