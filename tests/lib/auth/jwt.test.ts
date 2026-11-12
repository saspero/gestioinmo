// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { necessitaRenovacio, signToken, verifyToken } from '@/lib/auth/jwt';

const USUARI = {
  sub: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
  rol: 'gestor' as const,
  jti: '33333333-3333-4333-8333-333333333333',
};

describe('jwt', () => {
  it('verifica un token acabat de signar i conserva tenant, rol i jti', async () => {
    const payload = await verifyToken(await signToken(USUARI, 60));
    expect(payload).toMatchObject(USUARI);
  });

  it("només porta l'indicador de canvi de contrasenya quan cal", async () => {
    expect((await verifyToken(await signToken(USUARI, 60)))!.canvi_contrasenya).toBeUndefined();
    const amb = await verifyToken(await signToken({ ...USUARI, canvi_contrasenya: true }, 60));
    expect(amb!.canvi_contrasenya).toBe(true);
  });

  it('només demana renovar un token viu que ha passat la meitat de la vida', () => {
    const token = { iat: 1000, exp: 1000 + 3600 };
    expect(necessitaRenovacio(token, (1000 + 1000) * 1000)).toBe(false); // 1000 s de 3600
    expect(necessitaRenovacio(token, (1000 + 2000) * 1000)).toBe(true); // 2000 s de 3600
    expect(necessitaRenovacio(token, (1000 + 3600) * 1000)).toBe(false); // ja ha caducat
  });

  it("calcula l'expiració a partir dels minuts del tenant", async () => {
    const payload = await verifyToken(await signToken(USUARI, 30));
    expect(payload!.exp - payload!.iat).toBe(30 * 60);
  });

  it('retorna null per a un token manipulat', async () => {
    const token = await signToken(USUARI, 60);
    expect(await verifyToken(`${token.slice(0, -2)}xx`)).toBeNull();
  });

  it('retorna null per a un token mal format', async () => {
    expect(await verifyToken('no-es-un-jwt')).toBeNull();
  });

  it('retorna null si el payload no té el format esperat', async () => {
    const token = await signToken({ ...USUARI, tenant_id: 'no-es-uuid' }, 60);
    expect(await verifyToken(token)).toBeNull();
  });
});
