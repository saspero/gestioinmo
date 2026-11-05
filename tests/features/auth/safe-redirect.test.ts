import { describe, expect, it } from 'vitest';
import { RUTA_PER_DEFECTE, rutaSegura } from '@/features/auth/safe-redirect';

describe('rutaSegura', () => {
  it('conserva les rutes internes', () => {
    expect(rutaSegura('/propietats/123?x=1')).toBe('/propietats/123?x=1');
  });

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', '/login', '/login?from=/x', '', null, undefined, 3])(
    'rebutja %s',
    (valor) => {
      expect(rutaSegura(valor)).toBe(RUTA_PER_DEFECTE);
    }
  );
});
