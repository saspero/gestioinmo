// @vitest-environment node
//
// Fluxos de negoci complets contra PostgreSQL real (docs/requirements.md §5). Les regles
// viuen en triggers i constraints, així que un `pg` mockejat no les provaria.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { withTenantContext } from '@/lib/auth/tenant-context';
import {
  actualitzarContracte,
  crearContracte,
  donarBaixaContracte,
  llistarContractes,
  llistarInquilinsContracte,
  obtenirContracte,
  resoldreContracte,
} from '@/lib/db/contractes';
import {
  actualitzarDespesa,
  crearDespesa,
  donarBaixaDespesa,
  llistarDespeses,
  obtenirDespesa,
} from '@/lib/db/despeses';
import {
  actualitzarIncidencia,
  crearComentari,
  crearIncidencia,
  donarBaixaIncidencia,
  llistarComentaris,
  llistarIncidencies,
  obtenirIncidencia,
  resoldreIncidencia,
} from '@/lib/db/incidencies';
import { obtenirDadesExportacio, obtenirDashboard } from '@/lib/db/informes';
import {
  actualitzarPagament,
  anularPagament,
  cobrarPagament,
  crearPagament,
  crearRemesa,
  llistarPagaments,
  obtenirPagament,
  obtenirRemesa,
} from '@/lib/db/pagaments';
import { crearPersona, obtenirPersona } from '@/lib/db/persones';
import { getDomainPool } from '@/lib/db/pool';
import {
  actualitzarPropietat,
  actualitzarUnitat,
  crearPropietat,
  crearUnitat,
  donarBaixaPropietat,
  donarBaixaUnitat,
  llistarPropietats,
  llistarUnitats,
  obtenirUnitat,
} from '@/lib/db/propietats';
import { provisionarTenant } from '@/lib/db/tenants';
import { crearContracteSchema } from '@/lib/validations/contractes';
import { crearDespesaSchema } from '@/lib/validations/despeses';
import { crearIncidenciaSchema } from '@/lib/validations/incidencies';
import { crearPagamentSchema } from '@/lib/validations/pagaments';
import { actualitzarPropietatSchema, crearPropietatSchema } from '@/lib/validations/propietats';
import { recursExportEnum } from '@/lib/validations/informes';
import { crearBdTest } from '../helpers/test-db';

const adminUrl = process.env.TEST_DATABASE_URL;
const QUERY = { page: 1, pageSize: 20, order: 'asc' as const };

describe.skipIf(!adminUrl)('fluxos de negoci amb PostgreSQL real', () => {
  let eliminar: () => Promise<void>;
  let sessio: { tenant_id: string; sub: string };
  let sessioAltra: { tenant_id: string; sub: string };
  let propietatId: string;
  let unitat1: string;
  let unitat2: string;
  let inquiliId: string;

  const amb = <T,>(fn: (client: PoolClient) => Promise<T>) => withTenantContext(sessio, fn);
  const ambAltra = <T,>(fn: (client: PoolClient) => Promise<T>) => withTenantContext(sessioAltra, fn);

  const nouContracte = (unitatId: string, dataInici = '2026-01-01') =>
    amb((c) =>
      crearContracte(
        c,
        crearContracteSchema.parse({ unitatId, dataInici, renda: 800, fianca: 800, inquilinsIds: [inquiliId] })
      )
    );

  beforeAll(async () => {
    const bd = await crearBdTest(adminUrl!);
    eliminar = bd.eliminar;
    process.env.DATABASE_URL_DEV = bd.url;

    const admin = (email: string) => ({ email, nom: 'Admin', password: 'contrasenya-de-prova' });
    const { tenantId } = await provisionarTenant({ nom: 'Agència', slug: 'fluxos', admin: admin('f@test.cat') });
    const { tenantId: altra } = await provisionarTenant({ nom: 'Altra', slug: 'altra', admin: admin('o@test.cat') });

    const { rows } = await getDomainPool().query(
      'SELECT id, tenant_id FROM public.tenant_users WHERE tenant_id = ANY($1)',
      [[tenantId, altra]]
    );
    const usuariDe = (t: string) => rows.find((r) => r.tenant_id === t).id;
    sessio = { tenant_id: tenantId, sub: usuariDe(tenantId) };
    sessioAltra = { tenant_id: altra, sub: usuariDe(altra) };

    const propietat = await amb((c) =>
      crearPropietat(c, crearPropietatSchema.parse({ referencia: 'EDIF-1', tipus: 'edifici', adreca: 'Major 1', poblacio: 'Olot' }))
    );
    propietatId = propietat.id;
    unitat1 = (await amb((c) => crearUnitat(c, propietatId, { referencia: '1A', rendaBase: 800 }))).id;
    unitat2 = (await amb((c) => crearUnitat(c, propietatId, { referencia: '1B' }))).id;
    inquiliId = (await amb((c) => crearPersona(c, 'inquili', { nom: 'Ivet', nif: '87654321X' }))).id;
  }, 60_000);

  afterAll(async () => {
    await getDomainPool().end();
    await eliminar();
  });

  describe('propietats i unitats', () => {
    it('llista i filtra propietats', async () => {
      const filtre = { ...QUERY, tipus: 'edifici' as const, poblacio: 'Olot', q: 'EDIF' };
      expect((await amb((c) => llistarPropietats(c, filtre))).meta.total).toBe(1);
      expect((await amb((c) => llistarPropietats(c, { ...QUERY, q: 'res' }))).meta.total).toBe(0);
    });

    it('actualitza una propietat sense tocar la resta de camps', async () => {
      const parsed = actualitzarPropietatSchema.parse({ notes: 'Revisada' });
      const propietat = await amb((c) => actualitzarPropietat(c, propietatId, parsed));
      expect(propietat).toMatchObject({ notes: 'Revisada', tipus: 'edifici' });
    });

    it('gestiona cada unitat per separat (regla #1)', async () => {
      const unitats = await amb((c) => llistarUnitats(c, propietatId));
      expect(unitats.map((u) => u.referencia).sort()).toEqual(['1A', '1B']);

      const actualitzada = await amb((c) => actualitzarUnitat(c, unitat2, propietatId, { planta: '1' }));
      expect(actualitzada?.planta).toBe('1');
      expect(await amb((c) => obtenirUnitat(c, unitat2, propietatId))).toMatchObject({ referencia: '1B' });
    });

    it('rebutja referències repetides', async () => {
      await expect(amb((c) => crearUnitat(c, propietatId, { referencia: '1A' }))).rejects.toThrow();
    });

    it('dona de baixa una unitat i una propietat lliures', async () => {
      const lliure = await amb((c) => crearPropietat(c, crearPropietatSchema.parse({ referencia: 'B', adreca: 'C' })));
      const unitat = await amb((c) => crearUnitat(c, lliure.id, { referencia: 'X' }));
      expect(await amb((c) => donarBaixaUnitat(c, unitat.id, lliure.id))).toBe(true);
      expect(await amb((c) => donarBaixaPropietat(c, lliure.id))).toBe(true);
    });
  });

  describe('contractes', () => {
    it('només admet un contracte actiu per unitat, però diversos per inquilí (regla #2)', async () => {
      const primer = await nouContracte(unitat1);
      expect(await amb((c) => llistarInquilinsContracte(c, primer.id))).toEqual([inquiliId]);
      await amb((c) => actualitzarContracte(c, primer.id, { estat: 'actiu' }));

      const segon = await nouContracte(unitat1);
      await expect(amb((c) => actualitzarContracte(c, segon.id, { estat: 'actiu' }))).rejects.toThrow();

      const altraUnitat = await nouContracte(unitat2);
      const actiu = await amb((c) => actualitzarContracte(c, altraUnitat.id, { estat: 'actiu' }));
      expect(actiu?.estat).toBe('actiu');
    });

    it('filtra, actualitza i resol', async () => {
      const { data } = await amb((c) => llistarContractes(c, { ...QUERY, estat: 'actiu', unitatId: unitat2 }));
      expect(data).toHaveLength(1);
      const id = data[0].id;

      const canviat = await amb((c) => actualitzarContracte(c, id, { renda: 790 }));
      expect(Number(canviat?.renda)).toBe(790);

      const resolt = await amb((c) =>
        resoldreContracte(c, id, { motiuResolucio: 'Mutu acord', dataResolucio: '2026-06-30' })
      );
      expect(resolt?.estat).toBe('resolt');
      expect(await amb((c) => obtenirContracte(c, id))).toMatchObject({ estat: 'resolt' });
    });

    it('dona de baixa un esborrany', async () => {
      const esborrany = await nouContracte(unitat2);
      expect(await amb((c) => donarBaixaContracte(c, esborrany.id))).toBe(true);
      expect(await amb((c) => obtenirContracte(c, esborrany.id))).toBeNull();
    });
  });

  describe('pagaments', () => {
    let contracteId: string;

    const nouRebut = (dataVenciment: string) =>
      amb((c) => crearPagament(c, crearPagamentSchema.parse({ contracteId, import: 800, dataVenciment })));

    beforeAll(async () => {
      contracteId = (await nouContracte(unitat2, '2026-07-01')).id;
    });

    it('crea, filtra i actualitza rebuts', async () => {
      const rebut = await nouRebut('2026-08-01');
      expect(rebut.estat).toBe('pendent');
      expect((await amb((c) => llistarPagaments(c, { ...QUERY, contracteId }))).meta.total).toBe(1);

      const canviat = await amb((c) => actualitzarPagament(c, rebut.id, { concepte: 'Agost' }));
      expect(canviat?.concepte).toBe('Agost');
    });

    it('agrupa rebuts pendents en una remesa una sola vegada', async () => {
      const rebut = await nouRebut('2026-09-01');
      const remesa = await amb((c) => crearRemesa(c, { referencia: 'R-1', pagamentsIds: [rebut.id] }));
      expect(await amb((c) => obtenirRemesa(c, remesa.id))).toMatchObject({ referencia: 'R-1' });
      expect((await amb((c) => obtenirPagament(c, rebut.id)))?.estat).toBe('remesa');

      await expect(
        amb((c) => crearRemesa(c, { referencia: 'R-2', pagamentsIds: [rebut.id] }))
      ).rejects.toThrow('no està pendent');
    });

    it('cobra un rebut i no el deixa cobrar dues vegades', async () => {
      const rebut = await nouRebut('2026-10-01');
      const cobrament = { dataCobrament: '2026-10-02', metode: 'transferencia' as const };
      const cobrat = await amb((c) => cobrarPagament(c, rebut.id, cobrament));
      expect(cobrat?.estat).toBe('cobrat');
      await expect(amb((c) => cobrarPagament(c, rebut.id, cobrament))).rejects.toThrow();
    });

    it('marca com a morós després de 30 dies vençut i ho reverteix en cobrar (regla #5)', async () => {
      const rebut = await nouRebut('2020-01-01');
      await amb((c) => c.query('SELECT marcar_pagaments_vencuts()'));
      expect((await amb((c) => obtenirPagament(c, rebut.id)))?.estat).toBe('mora');
      expect((await amb((c) => obtenirPersona(c, inquiliId, 'inquili')))?.estatInquili).toBe('moros');

      const dashboard = await amb((c) => obtenirDashboard(c, {}));
      expect(dashboard.morositat.inquilinsMorosos).toBe(1);

      // Continua morós mentre quedi cap rebut en mora, no només el darrer.
      const { data: enMora } = await amb((c) => llistarPagaments(c, { ...QUERY, estat: 'mora' }));
      expect(enMora.length).toBeGreaterThan(1);
      const cobrament = { dataCobrament: '2026-11-01', metode: 'efectiu' as const };
      await amb((c) => cobrarPagament(c, enMora[0].id, cobrament));
      expect((await amb((c) => obtenirPersona(c, inquiliId, 'inquili')))?.estatInquili).toBe('moros');

      for (const pendent of enMora.slice(1)) {
        await amb((c) => cobrarPagament(c, pendent.id, cobrament));
      }
      expect((await amb((c) => obtenirPersona(c, inquiliId, 'inquili')))?.estatInquili).toBe('actiu');
    });

    it('anul·la un rebut amb soft delete', async () => {
      const rebut = await nouRebut('2026-12-01');
      expect(await amb((c) => anularPagament(c, rebut.id))).toBe(true);
      expect(await amb((c) => obtenirPagament(c, rebut.id))).toBeNull();
    });
  });

  describe('incidències', () => {
    const nova = (titol = 'Aixeta') =>
      amb((c) => crearIncidencia(c, crearIncidenciaSchema.parse({ unitatId: unitat1, titol })));

    it('assigna, comenta i filtra', async () => {
      const incidencia = await nova();
      const assignada = await amb((c) => actualitzarIncidencia(c, incidencia.id, { assignatA: sessio.sub, estat: 'assignada' }));
      expect(assignada?.estat).toBe('assignada');

      await amb((c) => crearComentari(c, incidencia.id, sessio.sub, { text: 'Hi vaig demà' }));
      expect(await amb((c) => llistarComentaris(c, incidencia.id))).toHaveLength(1);
      expect((await amb((c) => llistarIncidencies(c, { ...QUERY, estat: 'assignada' }))).meta.total).toBe(1);
    });

    it("no permet assignar un usuari d'un altre tenant", async () => {
      const incidencia = await nova();
      await expect(amb((c) => actualitzarIncidencia(c, incidencia.id, { assignatA: sessioAltra.sub }))).rejects.toThrow();
    });

    it('una incidència resolta no es pot reobrir (regla #6)', async () => {
      const incidencia = await nova();
      const resolta = await amb((c) => resoldreIncidencia(c, incidencia.id, { costFinal: 50 }));
      expect(resolta?.estat).toBe('resolta');
      await expect(amb((c) => actualitzarIncidencia(c, incidencia.id, { estat: 'oberta' }))).rejects.toThrow();
    });

    it('dona de baixa', async () => {
      const incidencia = await nova();
      expect(await amb((c) => donarBaixaIncidencia(c, incidencia.id))).toBe(true);
      expect(await amb((c) => obtenirIncidencia(c, incidencia.id))).toBeNull();
    });
  });

  describe('despeses', () => {
    const entrada = (extra: Record<string, unknown> = {}) =>
      crearDespesaSchema.parse({ propietatId, concepte: 'Pintura', import: 120, dataDespesa: '2026-03-01', ...extra });

    it('crea, filtra, actualitza i dona de baixa', async () => {
      const despesa = await amb((c) => crearDespesa(c, entrada({ unitatId: unitat1, categoria: 'manteniment' })));
      const filtre = { ...QUERY, propietatId, categoria: 'manteniment' as const, dataInici: '2026-01-01', dataFi: '2026-12-31' };
      expect((await amb((c) => llistarDespeses(c, filtre))).meta.total).toBe(1);

      const canviada = await amb((c) => actualitzarDespesa(c, despesa.id, { concepte: 'Pintura sala', import: 150 }));
      expect(canviada?.concepte).toBe('Pintura sala');

      expect(await amb((c) => donarBaixaDespesa(c, despesa.id))).toBe(true);
      expect(await amb((c) => obtenirDespesa(c, despesa.id))).toBeNull();
    });

    it("rebutja una unitat d'una altra propietat", async () => {
      const altra = await amb((c) => crearPropietat(c, crearPropietatSchema.parse({ referencia: 'D', adreca: 'E' })));
      await expect(
        amb((c) => crearDespesa(c, entrada({ propietatId: altra.id, unitatId: unitat1 })))
      ).rejects.toThrow();
    });
  });

  describe('informes', () => {
    it('calcula els indicadors del dashboard', async () => {
      const dashboard = await amb((c) => obtenirDashboard(c, { dataInici: '2026-01-01', dataFi: '2026-12-31' }));
      expect(dashboard.ocupacio.totalUnitats).toBeGreaterThanOrEqual(2);
      expect(Number(dashboard.ingressos.cobrat)).toBeGreaterThan(0);
      expect(dashboard.incidenciesObertes).toBeGreaterThan(0);

      const perPropietat = await amb((c) => obtenirDashboard(c, { propietatId }));
      expect(perPropietat.ocupacio.totalUnitats).toBe(2);
    });

    it.each(recursExportEnum.options)('exporta %s', async (recurs) => {
      const dades = await amb((c) => obtenirDadesExportacio(c, recurs));
      expect(dades.headers.length).toBeGreaterThan(0);
      expect(Array.isArray(dades.rows)).toBe(true);
    });
  });

  it('cap fila és visible des d’un altre tenant (regla #7)', async () => {
    expect((await ambAltra((c) => llistarContractes(c, QUERY))).meta.total).toBe(0);
    expect((await ambAltra((c) => llistarPagaments(c, QUERY))).meta.total).toBe(0);
    expect((await ambAltra((c) => llistarIncidencies(c, QUERY))).meta.total).toBe(0);
    expect((await ambAltra((c) => obtenirDashboard(c, {}))).ocupacio.totalUnitats).toBe(0);
  });
});
