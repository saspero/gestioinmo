// @vitest-environment node
//
// Fluxos de negoci complets contra PostgreSQL real (docs/requirements.md §5). Les regles
// viuen en triggers i constraints, així que un `pg` mockejat no les provaria.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { withTenantContext } from '@/lib/auth/tenant-context';
import {
  actualitzarContracte,
  crearConcepte,
  crearContracte,
  crearGarantia,
  donarBaixaConcepte,
  donarBaixaContracte,
  esborrarGarantia,
  llistarAvisosContractes,
  llistarConceptes,
  llistarContractes,
  llistarGaranties,
  modificarConcepte,
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
  generarRebuts,
  llistarLiniesPagament,
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

      // Un contracte actiu canvia la renda amb data d'efecte, no directament.
      await expect(amb((c) => actualitzarContracte(c, id, { renda: 790 }))).rejects.toThrow('data d\'efecte');

      // Regla #4: la fiança no segueix la renda, així que una pujada d'IPC no la toca.
      const [renda] = await amb((c) => llistarConceptes(c, id));
      await amb((c) => modificarConcepte(c, id, renda.id, { import: 2000, dataEfecte: '2026-01-02' }));
      const pujat = await amb((c) => obtenirContracte(c, id));
      expect(Number(pujat?.renda)).toBe(2000);
      expect(Number(pujat?.fianca)).toBe(800);

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

  describe('pactes del contracte', () => {
    let contracteId: string;
    const avui = new Date().toISOString().slice(0, 10);

    beforeAll(async () => {
      const pis = await amb((c) =>
        crearPropietat(c, crearPropietatSchema.parse({ referencia: 'PACTES-1', tipus: 'pis', adreca: 'Nou 1' }))
      );
      const [unitat] = await amb((c) => llistarUnitats(c, pis.id));
      const contracte = await amb((c) =>
        crearContracte(
          c,
          crearContracteSchema.parse({
            unitatId: unitat.id,
            dataInici: '2025-03-01',
            renda: 700,
            inquilinsIds: [inquiliId],
            duradaMesos: 60,
            prorrogaAutomatica: true,
            prorrogaMesos: 12,
            duradaMaximaMesos: 96,
            preavisDies: 30,
            tipusActualitzacio: 'percentatge_fix',
            percentatgePactat: 2,
            moblat: true,
          })
        )
      );
      contracteId = contracte.id;
    });

    it('desa els pactes, calcula la fi de la durada inicial i crea la renda inicial', async () => {
      const contracte = await amb((c) => obtenirContracte(c, contracteId));
      expect(contracte).toMatchObject({
        dataFi: '2030-02-28',
        duradaMesos: 60,
        prorrogaAutomatica: true,
        tipusActualitzacio: 'percentatge_fix',
        moblat: true,
      });
      expect(Number(contracte!.renda)).toBe(700);
      const conceptes = await amb((c) => llistarConceptes(c, contracteId));
      expect(conceptes).toMatchObject([{ tipus: 'renda', vigentDesDe: '2025-03-01', vigentFins: null }]);
    });

    it('canvia la renda amb data d\'efecte i en conserva l\'historial', async () => {
      const [renda] = await amb((c) => llistarConceptes(c, contracteId));
      await expect(
        amb((c) => modificarConcepte(c, contracteId, renda.id, { import: 750, dataEfecte: '2025-03-01' }))
      ).rejects.toThrow('posterior');

      const nova = await amb((c) =>
        modificarConcepte(c, contracteId, renda.id, { import: 714, dataEfecte: '2026-03-01', motiu: 'Actualització 2 %' })
      );
      expect(nova).toMatchObject({ tipus: 'renda', vigentDesDe: '2026-03-01', substitueixId: renda.id });
      expect(Number((await amb((c) => obtenirContracte(c, contracteId)))!.renda)).toBe(714);
      expect(Number((await amb((c) => obtenirContracte(c, contracteId)))!.rendaInicial)).toBe(700);

      // La fila substituïda ja no es pot tornar a modificar.
      await expect(
        amb((c) => modificarConcepte(c, contracteId, renda.id, { import: 720, dataEfecte: '2026-06-01' }))
      ).rejects.toThrow('substituït');

      // Un canvi futur no afecta la renda vigent d'avui.
      await amb((c) => modificarConcepte(c, contracteId, nova!.id, { import: 999, dataEfecte: '2099-01-01' }));
      expect(Number((await amb((c) => obtenirContracte(c, contracteId)))!.renda)).toBe(714);
    });

    it('afegeix i dona de baixa despeses repercutides', async () => {
      const escombraries = await amb((c) =>
        crearConcepte(c, contracteId, {
          tipus: 'escombraries',
          import: 120,
          periodicitat: 'anual',
          mesCobrament: 6,
          vigentDesDe: '2025-03-01',
        })
      );
      const baixa = await amb((c) => donarBaixaConcepte(c, contracteId, escombraries.id, { dataEfecte: avui }));
      expect(baixa?.vigentFins).not.toBeNull();

      // Una despesa que encara no havia començat s'esborra.
      const futura = await amb((c) =>
        crearConcepte(c, contracteId, { tipus: 'comunitat', import: 40, periodicitat: 'mensual', vigentDesDe: '2099-01-01' })
      );
      await amb((c) => donarBaixaConcepte(c, contracteId, futura.id, { dataEfecte: '2098-01-01' }));
      const tipus = (await amb((c) => llistarConceptes(c, contracteId))).map((cc) => cc.tipus);
      expect(tipus).not.toContain('comunitat');

      const [renda] = await amb((c) => llistarConceptes(c, contracteId));
      await expect(amb((c) => donarBaixaConcepte(c, contracteId, renda.id, { dataEfecte: avui }))).rejects.toThrow();
    });

    it('no deixa canviar directament la renda d\'un contracte actiu i recalcula la fi amb una durada nova', async () => {
      await amb((c) => actualitzarContracte(c, contracteId, { estat: 'actiu' }));
      await expect(amb((c) => actualitzarContracte(c, contracteId, { renda: 800 }))).rejects.toThrow('data d\'efecte');

      const actualitzat = await amb((c) =>
        actualitzarContracte(c, contracteId, { duradaMesos: 12, preavisDies: null, moblat: false })
      );
      expect(actualitzat).toMatchObject({ dataFi: '2026-02-28', duradaMesos: 12, preavisDies: null, moblat: false });
    });

    it('desa i esborra garanties', async () => {
      const aval = await amb((c) =>
        crearGarantia(c, contracteId, { tipus: 'aval_bancari', import: 4200, entitat: 'Banc', dataVenciment: '2030-01-01' })
      );
      expect(await amb((c) => llistarGaranties(c, contracteId))).toHaveLength(1);
      expect(await amb((c) => esborrarGarantia(c, contracteId, aval.id))).toBe(true);
      expect(await amb((c) => llistarGaranties(c, contracteId))).toHaveLength(0);
    });

    it('genera el rebut del mes amb una línia per la renda i per cada despesa', async () => {
      const des = '2099-01-01';
      await amb(async (c) => {
        await crearConcepte(c, contracteId, { tipus: 'ibi', import: 600, periodicitat: 'anual', vigentDesDe: des });
        await crearConcepte(c, contracteId, { tipus: 'comunitat', import: 35.5, periodicitat: 'mensual', vigentDesDe: des });
        await crearConcepte(c, contracteId, {
          tipus: 'escombraries',
          import: 90,
          periodicitat: 'anual',
          mesCobrament: 7,
          vigentDesDe: des,
        });
      });

      const juliol = await amb((c) => generarRebuts(c, { periode: '2099-07' }));
      expect(juliol.creats).toBeGreaterThanOrEqual(1);
      await amb((c) => generarRebuts(c, { periode: '2099-08' }));

      const rebutDe = async (periode: string) => {
        const { data } = await amb((c) => llistarPagaments(c, { ...QUERY, contracteId }));
        const rebut = data.find((p) => p.periode === periode);
        expect(rebut).toBeDefined();
        return { rebut: rebut!, linies: await amb((c) => llistarLiniesPagament(c, rebut!.id)) };
      };

      const { rebut, linies } = await rebutDe('2099-07');
      expect(rebut).toMatchObject({ concepte: 'Lloguer de juliol de 2099', dataVenciment: '2099-07-01', estat: 'pendent' });
      expect(Number(rebut.import)).toBe(1174.5);
      expect(linies.map((l) => [l.descripcio, Number(l.import)])).toEqual([
        ['Renda', 999],
        ['IBI, part mensual (1/12)', 50],
        ['Comunitat', 35.5],
        ["Taxa d'escombraries, anual", 90],
      ]);

      // L'escombraries anual només es cobra el juliol.
      const agost = await rebutDe('2099-08');
      expect(Number(agost.rebut.import)).toBe(1084.5);
      expect(agost.linies).toHaveLength(3);

      // Tornar a generar el mateix mes no duplica rebuts.
      const repetit = await amb((c) => generarRebuts(c, { periode: '2099-07' }));
      expect(repetit).toMatchObject({ creats: 0, jaExistien: juliol.creats });

      // Neteja (més avall): no afectar els comptadors dels altres tests.
      const avisos = await amb((c) => llistarAvisosContractes(c, '2025-10-15'));
      const nostre = avisos.find((a) => a.contracteId === contracteId);
      expect(nostre?.nom).toContain('Nou 1');
      // La renda ja té un canvi programat (2099), així que només queda l'avís de no renovar.
      expect(nostre?.avisos).toMatchObject([{ tipus: 'no_renovacio', venciment: '2026-02-28', limit: '2025-10-31' }]);

      await amb((c) => c.query("UPDATE pagaments SET deleted_at = now() WHERE periode >= '2099-01-01'"));
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

    it('deixa 5 dies de marge abans de marcar un rebut com a vençut, a tots els tenants', async () => {
      const faDies = (dies: number) => new Date(Date.now() - dies * 86_400_000).toISOString().slice(0, 10);
      const recent = await nouRebut(faDies(3));
      const passat = await nouRebut(faDies(7));

      // La mateixa crida que fa pg_cron cada nit.
      await getDomainPool().query('SELECT public.marcar_pagaments_vencuts_tots_tenants()');

      expect((await amb((c) => obtenirPagament(c, recent.id)))?.estat).toBe('pendent');
      expect((await amb((c) => obtenirPagament(c, passat.id)))?.estat).toBe('vencut');
      // Vençut però encara no en mora: l'inquilí no passa a morós.
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
