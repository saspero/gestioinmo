import { describe, expect, it } from 'vitest';
import { loginSchema } from '@/lib/validations/auth';
import { dateStringSchema, zodFieldErrors } from '@/lib/validations/common';
import { actualitzarTenantSchema, crearUsuariSchema } from '@/lib/validations/configuracio';
import { crearContracteSchema } from '@/lib/validations/contractes';
import { crearDespesaSchema } from '@/lib/validations/despeses';
import { actualitzarIncidenciaSchema } from '@/lib/validations/incidencies';
import { crearPagamentSchema, crearRemesaSchema } from '@/lib/validations/pagaments';
import { crearPropietariSchema } from '@/lib/validations/persones';
import {
  actualitzarPropietatSchema,
  crearPropietatSchema,
  titularSchema,
} from '@/lib/validations/propietats';
import { provisionarTenantSchema } from '@/lib/validations/tenants';

const UUID = '11111111-1111-4111-8111-111111111111';

const contracte = (extra: Record<string, unknown> = {}) => ({
  unitatId: UUID,
  dataInici: '2026-01-01',
  renda: 1000,
  fianca: 1000,
  inquilinsIds: [UUID],
  ...extra,
});

describe('auth', () => {
  it("normalitza l'email", () => {
    expect(loginSchema.parse({ email: ' Anna@Test.CAT ', password: 'x' }).email).toBe('anna@test.cat');
  });

  it('exigeix email vàlid i contrasenya', () => {
    expect(loginSchema.safeParse({ email: 'no', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.cat', password: '' }).success).toBe(false);
  });
});

describe('contractes', () => {
  it('per defecte, la fiança és una mensualitat', () => {
    expect(crearContracteSchema.parse(contracte({ fianca: undefined })).fianca).toBe(1000);
  });

  it('accepta qualsevol fiança pactada, sigui quin sigui l’ús', () => {
    expect(crearContracteSchema.parse(contracte({ fianca: 0 })).fianca).toBe(0);
    expect(crearContracteSchema.parse(contracte({ fianca: 500 })).fianca).toBe(500);
    expect(crearContracteSchema.parse(contracte({ fianca: 3000 })).fianca).toBe(3000);
    expect(crearContracteSchema.parse(contracte({ tipusUs: 'local', fianca: 9000 })).fianca).toBe(9000);
  });

  it('rebutja una fiança negativa i marca el camp', () => {
    const result = crearContracteSchema.safeParse(contracte({ fianca: -1 }));
    expect(result.success).toBe(false);
    if (!result.success) expect(zodFieldErrors(result.error).fianca).toBeDefined();
  });

  it("exigeix data de fi posterior a la d'inici", () => {
    expect(crearContracteSchema.safeParse(contracte({ dataFi: '2026-01-01' })).success).toBe(false);
  });

  it('exigeix almenys un inquilí', () => {
    expect(crearContracteSchema.safeParse(contracte({ inquilinsIds: [] })).success).toBe(false);
  });
});

describe('propietats', () => {
  it('aplica valors per defecte en crear', () => {
    expect(crearPropietatSchema.parse({ referencia: 'A', adreca: 'B' })).toMatchObject({ tipus: 'pis', ascensor: false });
  });

  it('un PATCH parcial no reescriu camps amb valor per defecte', () => {
    const parsed = actualitzarPropietatSchema.parse({ titulars: [{ personaId: UUID, percentatge: 100 }] });
    expect(parsed).not.toHaveProperty('tipus');
    expect(parsed).not.toHaveProperty('ascensor');
  });

  it('limita el percentatge de titularitat a (0, 100]', () => {
    expect(titularSchema.safeParse({ personaId: UUID, percentatge: 100 }).success).toBe(true);
    expect(titularSchema.safeParse({ personaId: UUID, percentatge: 0 }).success).toBe(false);
    expect(titularSchema.safeParse({ personaId: UUID, percentatge: 100.01 }).success).toBe(false);
  });
});

describe('persones', () => {
  it('valida el format del NIF', () => {
    expect(crearPropietariSchema.safeParse({ nom: 'A', nif: '12345678Z' }).success).toBe(true);
    expect(crearPropietariSchema.safeParse({ nom: 'A', nif: '12-34' }).success).toBe(false);
  });

  it('exigeix el nom', () => {
    expect(crearPropietariSchema.safeParse({ nom: '  ' }).success).toBe(false);
  });
});

describe('pagaments i despeses', () => {
  it('exigeix import positiu', () => {
    expect(crearPagamentSchema.safeParse({ contracteId: UUID, import: 0, dataVenciment: '2026-01-01' }).success).toBe(false);
    expect(
      crearDespesaSchema.safeParse({ propietatId: UUID, concepte: 'x', import: -1, dataDespesa: '2026-01-01' }).success
    ).toBe(false);
  });

  it('una remesa necessita almenys un rebut', () => {
    expect(crearRemesaSchema.safeParse({ referencia: 'R1', pagamentsIds: [] }).success).toBe(false);
  });

  it('rebutja dates mal formades', () => {
    expect(dateStringSchema.safeParse('01/02/2026').success).toBe(false);
  });
});

describe('incidències', () => {
  it("el PATCH no ofereix l'estat resolta (regla #6)", () => {
    expect(actualitzarIncidenciaSchema.safeParse({ estat: 'resolta' }).success).toBe(false);
  });
});

describe('configuració', () => {
  it("limita l'expiració de la sessió", () => {
    expect(actualitzarTenantSchema.safeParse({ nom: 'A', jwtExpiracioMinuts: '60' }).success).toBe(true);
    expect(actualitzarTenantSchema.safeParse({ nom: 'A', jwtExpiracioMinuts: '4' }).success).toBe(false);
    expect(actualitzarTenantSchema.safeParse({ nom: 'A', jwtExpiracioMinuts: '1441' }).success).toBe(false);
  });

  it('converteix textos buits en absents', () => {
    expect(actualitzarTenantSchema.parse({ nom: 'A', nif: ' ', jwtExpiracioMinuts: 60 }).nif).toBeUndefined();
  });

  it('només admet rols coneguts', () => {
    expect(crearUsuariSchema.safeParse({ email: 'a@b.cat', nom: 'A', rol: 'superadmin' }).success).toBe(false);
  });
});

describe('provisioning', () => {
  const entrada = {
    nom: 'Agència',
    slug: 'agencia-1',
    admin: { email: 'a@b.cat', nom: 'Anna', password: 'prou-llarga-123' },
  };

  it('accepta dades vàlides', () => {
    expect(provisionarTenantSchema.safeParse(entrada).success).toBe(true);
  });

  it('rebutja slugs no normalitzats', () => {
    expect(provisionarTenantSchema.safeParse({ ...entrada, slug: 'Mal Slug' }).success).toBe(false);
  });

  it('exigeix una contrasenya de 12 caràcters', () => {
    const admin = { ...entrada.admin, password: 'curta' };
    expect(provisionarTenantSchema.safeParse({ ...entrada, admin }).success).toBe(false);
  });
});
