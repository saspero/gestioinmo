import { describe, expect, it } from 'vitest';
import { canviContrasenyaSchema, loginSchema } from '@/lib/validations/auth';
import { dateStringSchema, zodFieldErrors } from '@/lib/validations/common';
import { actualitzarTenantSchema, crearUsuariSchema } from '@/lib/validations/configuracio';
import { crearContracteSchema } from '@/lib/validations/contractes';
import { crearDespesaSchema } from '@/lib/validations/despeses';
import { actualitzarIncidenciaSchema } from '@/lib/validations/incidencies';
import { crearPagamentSchema, crearRemesaSchema } from '@/lib/validations/pagaments';
import { actualitzarPersonaSchema, crearPropietariSchema } from '@/lib/validations/persones';
import {
  actualitzarPropietatSchema,
  teUnitatUnica,
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

describe('canvi de contrasenya', () => {
  const canvi = (dades: Record<string, string>) =>
    canviContrasenyaSchema.safeParse({ actual: 'antiga-1234', nova: 'nova-123456', confirmacio: 'nova-123456', ...dades });
  const errors = (dades: Record<string, string>) => {
    const result = canvi(dades);
    return result.success ? {} : zodFieldErrors(result.error);
  };

  it('accepta una contrasenya nova vàlida i confirmada', () => {
    expect(canvi({}).success).toBe(true);
  });

  it('exigeix un mínim de 10 caràcters i com a màxim 72 bytes', () => {
    expect(errors({ nova: 'curta', confirmacio: 'curta' }).nova).toContain('10');
    const llarga = 'à'.repeat(37);
    expect(errors({ nova: llarga, confirmacio: llarga }).nova).toBeDefined();
  });

  it('exigeix que la confirmació coincideixi i que sigui diferent de l’actual', () => {
    expect(errors({ confirmacio: 'una-altra-cosa' }).confirmacio).toBeDefined();
    expect(errors({ nova: 'antiga-1234', confirmacio: 'antiga-1234' }).nova).toBeDefined();
    expect(errors({ actual: '' }).actual).toBeDefined();
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

  it('en crear, descarta els camps que no corresponen al tipus', () => {
    const tots = {
      referencia: 'A',
      adreca: 'B',
      referenciaCadastral: '1234567AB1234C0001XY',
      superficie: 12,
      habitacions: 3,
      banys: 1,
      ascensor: true,
      numeroPlaca: '42',
      planta: '-1',
      numPisos: 4,
      superficieEdificable: 300,
      tipusSol: 'urbanitzable' as const,
    };
    const parking = crearPropietatSchema.parse({ ...tots, tipus: 'parking' });
    expect(parking).toMatchObject({ superficie: 12, numeroPlaca: '42', planta: '-1', ascensor: false });
    expect(parking).not.toHaveProperty('habitacions');
    expect(parking).not.toHaveProperty('tipusSol');
    // La referència cadastral la tenen tots els tipus.
    expect(parking.referenciaCadastral).toBe('1234567AB1234C0001XY');

    const solar = crearPropietatSchema.parse({ ...tots, tipus: 'solar' });
    expect(solar).toMatchObject({ superficieEdificable: 300, tipusSol: 'urbanitzable', ascensor: false });
    expect(solar).not.toHaveProperty('banys');

    const edifici = crearPropietatSchema.parse({ ...tots, tipus: 'edifici' });
    expect(edifici).toMatchObject({ numPisos: 4, ascensor: true });
    expect(edifici).not.toHaveProperty('numeroPlaca');

    const local = crearPropietatSchema.parse({ ...tots, tipus: 'local' });
    expect(local).toMatchObject({ banys: 1, ascensor: true });
    expect(local).not.toHaveProperty('habitacions');
  });

  it('un PATCH parcial no reescriu camps amb valor per defecte', () => {
    const parsed = actualitzarPropietatSchema.parse({ titulars: [{ personaId: UUID, percentatge: 100 }] });
    expect(parsed).not.toHaveProperty('tipus');
    expect(parsed).not.toHaveProperty('ascensor');
  });

  it('en editar, accepta null per esborrar camps', () => {
    expect(actualitzarPropietatSchema.parse({ superficie: null, referenciaCadastral: null, notes: null })).toEqual({
      superficie: null,
      referenciaCadastral: null,
      notes: null,
    });
    expect(actualitzarPropietatSchema.safeParse({ adreca: null }).success).toBe(false);
  });

  it('en canviar el tipus, esborra els camps que el tipus nou no té', () => {
    const parsed = actualitzarPropietatSchema.parse({ tipus: 'parking', numeroPlaca: '12', habitacions: 3 });
    expect(parsed).toMatchObject({
      tipus: 'parking',
      numeroPlaca: '12',
      habitacions: null,
      banys: null,
      tipusSol: null,
      ascensor: false,
    });
    expect(parsed).not.toHaveProperty('superficie');
  });

  it('només els edificis poden tenir diverses unitats', () => {
    expect(teUnitatUnica('pis')).toBe(true);
    expect(teUnitatUnica('parking')).toBe(true);
    expect(teUnitatUnica('edifici')).toBe(false);
  });

  it('limita el percentatge de titularitat a (0, 100]', () => {
    expect(titularSchema.safeParse({ personaId: UUID, percentatge: 100 }).success).toBe(true);
    expect(titularSchema.safeParse({ personaId: UUID, percentatge: 0 }).success).toBe(false);
    expect(titularSchema.safeParse({ personaId: UUID, percentatge: 100.01 }).success).toBe(false);
  });
});

describe('persones', () => {
  it('en editar, accepta null per esborrar camps però no el nom', () => {
    expect(actualitzarPersonaSchema.parse({ email: null, nif: null, representantNif: null })).toEqual({
      email: null,
      nif: null,
      representantNif: null,
    });
    expect(actualitzarPersonaSchema.safeParse({ nom: null }).success).toBe(false);
    expect(actualitzarPersonaSchema.safeParse({ email: 'no-és-email' }).success).toBe(false);
    // En una alta, null no té sentit.
    expect(crearPropietariSchema.safeParse({ nom: 'A', email: null }).success).toBe(false);
  });

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
