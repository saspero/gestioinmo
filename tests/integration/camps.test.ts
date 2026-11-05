// @vitest-environment node
//
// Camps opcionals, filtres i casos "no trobat" de la capa de BD, contra PostgreSQL real:
// les queries es construeixen dinàmicament i cada combinació pot trencar la numeració de `$n`.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { withTenantContext } from '@/lib/auth/tenant-context';
import { actualitzarContracte, crearContracte, llistarContractes, obtenirContracte, resoldreContracte } from '@/lib/db/contractes';
import { actualitzarDespesa, crearDespesa, donarBaixaDespesa, llistarDespeses } from '@/lib/db/despeses';
import {
  actualitzarIncidencia,
  crearIncidencia,
  donarBaixaIncidencia,
  llistarIncidencies,
  resoldreIncidencia,
} from '@/lib/db/incidencies';
import { obtenirDashboard } from '@/lib/db/informes';
import { actualitzarPagament, anularPagament, crearPagament, crearRemesa, llistarPagaments, obtenirRemesa } from '@/lib/db/pagaments';
import { actualitzarPersona, crearPersona, llistarPersones, obtenirPersona } from '@/lib/db/persones';
import { getDomainPool } from '@/lib/db/pool';
import {
  actualitzarPropietat,
  actualitzarUnitat,
  crearPropietat,
  crearUnitat,
  donarBaixaPropietat,
  donarBaixaUnitat,
  llistarPropietats,
  obtenirPropietat,
  obtenirUnitat,
} from '@/lib/db/propietats';
import { provisionarTenant } from '@/lib/db/tenants';
import { actualitzarTenantConfig, canviarEstatUsuari, obtenirTenantConfig } from '@/lib/db/usuaris';
import { crearContracteSchema } from '@/lib/validations/contractes';
import { crearDespesaSchema } from '@/lib/validations/despeses';
import { crearIncidenciaSchema } from '@/lib/validations/incidencies';
import { crearPagamentSchema } from '@/lib/validations/pagaments';
import { crearPropietatSchema } from '@/lib/validations/propietats';
import { crearBdTest } from '../helpers/test-db';

const adminUrl = process.env.TEST_DATABASE_URL;
const QUERY = { page: 1, pageSize: 20, order: 'asc' as const };
const INEXISTENT = '99999999-9999-4999-8999-999999999999';

describe.skipIf(!adminUrl)('camps opcionals i casos límit', () => {
  let eliminar: () => Promise<void>;
  let tenantId: string;
  let sessio: { tenant_id: string; sub: string };
  let propietatId: string;
  let unitatId: string;
  let inquiliId: string;
  let contracteId: string;
  let incidenciaId: string;

  const amb = <T,>(fn: (client: PoolClient) => Promise<T>) => withTenantContext(sessio, fn);

  beforeAll(async () => {
    const bd = await crearBdTest(adminUrl!);
    eliminar = bd.eliminar;
    process.env.DATABASE_URL_DEV = bd.url;

    ({ tenantId } = await provisionarTenant({
      nom: 'Agència',
      slug: 'camps',
      admin: { email: 'c@test.cat', nom: 'Admin', cognoms: 'Prova', password: 'contrasenya-de-prova' },
    }));
    const { rows } = await getDomainPool().query('SELECT id FROM public.tenant_users WHERE tenant_id = $1', [tenantId]);
    sessio = { tenant_id: tenantId, sub: rows[0].id };

    const propietat = await amb((c) =>
      crearPropietat(
        c,
        crearPropietatSchema.parse({
          referencia: 'P',
          tipus: 'casa',
          adreca: 'A',
          poblacio: 'Olot',
          cp: '17800',
          superficie: 90,
          habitacions: 3,
          banys: 2,
          ascensor: true,
          certEnergetic: 'B',
          notes: 'n',
        })
      )
    );
    propietatId = propietat.id;
    unitatId = (await amb((c) => crearUnitat(c, propietatId, { referencia: 'U', planta: '1', porta: 'A', superficie: 50, rendaBase: 500 }))).id;
    inquiliId = (await amb((c) => crearPersona(c, 'inquili', { nom: 'Ivet', cognoms: 'Roca', email: 'i@x.cat', telefon: '6', adreca: 'B', notes: 'n' }))).id;

    contracteId = (
      await amb((c) =>
        crearContracte(
          c,
          crearContracteSchema.parse({
            unitatId,
            tipusUs: 'local',
            dataInici: '2026-01-01',
            dataFi: '2027-01-01',
            renda: 900,
            fianca: 2000,
            indexActualitzacio: 'IGC',
            percentatgePactat: 2,
            documentUrl: 'https://exemple.cat/contracte.pdf',
            inquilinsIds: [inquiliId],
          })
        )
      )
    ).id;
    incidenciaId = (
      await amb((c) =>
        crearIncidencia(
          c,
          crearIncidenciaSchema.parse({
            unitatId,
            contracteId,
            reportadorId: inquiliId,
            titol: 'T',
            descripcio: 'D',
            prioritat: 'urgent',
          })
        )
      )
    ).id;
  }, 60_000);

  afterAll(async () => {
    await getDomainPool().end();
    await eliminar();
  });

  it('desfà el tenant si el provisioning falla a mitges', async () => {
    const admin = { email: 'f@test.cat', nom: 'F', password: 'contrasenya-de-prova' };
    await expect(provisionarTenant({ nom: 'Fallit', slug: 'fallit', admin }, 'directori-inexistent')).rejects.toThrow();

    const pool = getDomainPool();
    const tenants = await pool.query(`SELECT 1 FROM public.tenants WHERE slug = 'fallit'`);
    expect(tenants.rowCount).toBe(0);
    const schemes = await pool.query(`SELECT count(*)::int AS n FROM pg_namespace WHERE nspname LIKE 'tenant_%'`);
    expect(schemes.rows[0].n).toBe(1);
  });

  it('avisa si falta la migració d’extensions', async () => {
    const pool = getDomainPool();
    await pool.query('ALTER EXTENSION pg_trgm SET SCHEMA public');
    const admin = { email: 'g@test.cat', nom: 'G', password: 'contrasenya-de-prova' };
    await expect(provisionarTenant({ nom: 'Sense', slug: 'sense', admin })).rejects.toThrow('012_extensions_schema');
    await pool.query('ALTER EXTENSION pg_trgm SET SCHEMA extensions');
  });

  it('actualitza tots els camps de persona, inclosos els xifrats', async () => {
    const persona = await amb((c) =>
      actualitzarPersona(c, inquiliId, 'inquili', {
        nom: 'Ivet2',
        cognoms: 'Roca2',
        telefon: '7',
        adreca: 'C',
        notes: 'm',
        nif: '87654321X',
        email: 'nou@x.cat',
        iban: 'ES99',
      })
    );
    expect(persona).toMatchObject({ nom: 'Ivet2', nif: '87654321X', email: 'nou@x.cat', iban: 'ES99' });
    expect(await amb((c) => actualitzarPersona(c, inquiliId, 'inquili', {}))).toMatchObject({ nom: 'Ivet2' });
    expect(await amb((c) => actualitzarPersona(c, INEXISTENT, 'inquili', { telefon: '1' }))).toBeNull();
    expect(await amb((c) => obtenirPersona(c, INEXISTENT, 'inquili'))).toBeNull();
  });

  it('filtra persones per text i estat', async () => {
    const filtre = { ...QUERY, q: 'Ivet', estatInquili: 'actiu' as const, sort: 'cognoms' };
    expect((await amb((c) => llistarPersones(c, 'inquili', filtre))).meta.total).toBe(1);
  });

  it('actualitza propietats i unitats amb tots els camps', async () => {
    const propietat = await amb((c) =>
      actualitzarPropietat(c, propietatId, {
        referencia: 'P2',
        tipus: 'pis',
        adreca: 'A2',
        poblacio: 'Vic',
        cp: '08500',
        superficie: 80,
        habitacions: 2,
        banys: 1,
        ascensor: false,
        certEnergetic: 'C',
        notes: 'm',
      })
    );
    expect(propietat).toMatchObject({ referencia: 'P2', poblacio: 'Vic' });
    expect(await amb((c) => actualitzarPropietat(c, propietatId, {}))).toMatchObject({ referencia: 'P2' });
    expect(await amb((c) => actualitzarPropietat(c, INEXISTENT, { notes: 'x' }))).toBeNull();
    expect(await amb((c) => obtenirPropietat(c, INEXISTENT))).toBeNull();
    expect((await amb((c) => llistarPropietats(c, { ...QUERY, sort: 'referencia', order: 'desc' }))).meta.total).toBe(1);

    const unitat = await amb((c) =>
      actualitzarUnitat(c, unitatId, propietatId, { referencia: 'U2', planta: '2', porta: 'B', superficie: 40, rendaBase: 400 })
    );
    expect(unitat).toMatchObject({ referencia: 'U2', planta: '2' });
    expect(await amb((c) => actualitzarUnitat(c, unitatId, propietatId, {}))).toMatchObject({ referencia: 'U2' });
    expect(await amb((c) => actualitzarUnitat(c, unitatId, INEXISTENT, { planta: '3' }))).toBeNull();
    expect(await amb((c) => obtenirUnitat(c, INEXISTENT, propietatId))).toBeNull();
    expect(await amb((c) => donarBaixaUnitat(c, INEXISTENT, propietatId))).toBe(false);
    expect(await amb((c) => donarBaixaPropietat(c, INEXISTENT))).toBe(false);
  });

  it('actualitza contractes amb tots els camps i filtra per ús', async () => {
    const contracte = await amb((c) =>
      actualitzarContracte(c, contracteId, {
        dataFi: '2028-01-01',
        renda: 950,
        fianca: 2100,
        indexActualitzacio: 'IPC',
        percentatgePactat: 3,
        documentUrl: 'https://exemple.cat/nou.pdf',
      })
    );
    expect(contracte).toMatchObject({ indexActualitzacio: 'IPC' });
    expect(await amb((c) => actualitzarContracte(c, contracteId, {}))).not.toBeNull();
    expect(await amb((c) => actualitzarContracte(c, INEXISTENT, { renda: 1 }))).toBeNull();
    expect(await amb((c) => obtenirContracte(c, INEXISTENT))).toBeNull();
    expect((await amb((c) => llistarContractes(c, { ...QUERY, tipusUs: 'local', sort: 'renda' }))).meta.total).toBe(1);
  });

  it('filtra rebuts per estat i remesa i gestiona els inexistents', async () => {
    const rebut = await amb((c) =>
      crearPagament(c, crearPagamentSchema.parse({ contracteId, concepte: 'Gener', import: 950, dataVenciment: '2030-01-01' }))
    );
    const remesa = await amb((c) =>
      crearRemesa(c, { referencia: 'R', pagamentsIds: [rebut.id], dataEnviament: '2030-01-02' })
    );
    expect((await amb((c) => llistarPagaments(c, { ...QUERY, remesaId: remesa.id, estat: 'remesa', contracteId }))).meta.total).toBe(1);

    const data = await amb((c) => actualitzarPagament(c, rebut.id, { dataVenciment: '2030-02-01' }));
    expect(data).not.toBeNull();
    expect(await amb((c) => actualitzarPagament(c, rebut.id, {}))).not.toBeNull();
    expect(await amb((c) => actualitzarPagament(c, INEXISTENT, { concepte: 'x' }))).toBeNull();
    expect(await amb((c) => anularPagament(c, INEXISTENT))).toBe(false);
    expect(await amb((c) => obtenirRemesa(c, INEXISTENT))).toBeNull();
    await expect(amb((c) => crearRemesa(c, { referencia: 'R3', pagamentsIds: [INEXISTENT] }))).rejects.toThrow();
  });

  it('actualitza incidències amb tots els camps i filtra', async () => {
    const incidencia = await amb((c) =>
      actualitzarIncidencia(c, incidenciaId, {
        titol: 'T2',
        descripcio: 'D2',
        prioritat: 'alta',
        estat: 'en_curs',
        assignatA: sessio.sub,
        costEstimat: 10,
        costFinal: 20,
      })
    );
    expect(incidencia).toMatchObject({ titol: 'T2', estat: 'en_curs' });
    expect(await amb((c) => actualitzarIncidencia(c, incidenciaId, {}))).not.toBeNull();
    expect(await amb((c) => actualitzarIncidencia(c, INEXISTENT, { titol: 'x' }))).toBeNull();

    const filtre = { ...QUERY, estat: 'en_curs' as const, prioritat: 'alta' as const, unitatId, assignatA: sessio.sub, sort: 'titol' };
    expect((await amb((c) => llistarIncidencies(c, filtre))).meta.total).toBe(1);

    expect(await amb((c) => resoldreIncidencia(c, INEXISTENT, {}))).toBeNull();
    expect(await amb((c) => resoldreIncidencia(c, incidenciaId, {}))).toMatchObject({ estat: 'resolta' });
    expect(await amb((c) => donarBaixaIncidencia(c, INEXISTENT))).toBe(false);
  });

  it('resol contractes inexistents sense error', async () => {
    const entrada = { motiuResolucio: 'x', dataResolucio: '2026-01-01' };
    expect(await amb((c) => resoldreContracte(c, INEXISTENT, entrada))).toBeNull();
  });

  it('crea i actualitza despeses amb tots els camps', async () => {
    const despesa = await amb((c) =>
      crearDespesa(
        c,
        crearDespesaSchema.parse({
          propietatId,
          unitatId,
          incidenciaId,
          categoria: 'gestoria',
          concepte: 'C',
          import: 10,
          dataDespesa: '2026-02-01',
          proveidor: 'P',
          facturaUrl: 'https://exemple.cat/f.pdf',
          repercutiblePropietari: false,
          notes: 'n',
        })
      )
    );
    const actualitzada = await amb((c) =>
      actualitzarDespesa(c, despesa.id, {
        unitatId,
        incidenciaId,
        categoria: 'altres',
        concepte: 'C2',
        import: 20,
        dataDespesa: '2026-03-01',
        proveidor: 'Q',
        facturaUrl: 'https://exemple.cat/g.pdf',
        repercutiblePropietari: true,
        notes: 'm',
      })
    );
    expect(actualitzada).toMatchObject({ concepte: 'C2', categoria: 'altres' });
    expect(await amb((c) => actualitzarDespesa(c, despesa.id, {}))).not.toBeNull();
    expect(await amb((c) => actualitzarDespesa(c, INEXISTENT, { notes: 'x' }))).toBeNull();
    expect(await amb((c) => donarBaixaDespesa(c, INEXISTENT))).toBe(false);

    const filtre = { ...QUERY, unitatId, incidenciaId, sort: 'import' };
    expect((await amb((c) => llistarDespeses(c, filtre))).meta.total).toBe(1);
    await expect(amb((c) => actualitzarDespesa(c, despesa.id, { unitatId: INEXISTENT }))).rejects.toThrow();
    await expect(amb((c) => actualitzarDespesa(c, despesa.id, { incidenciaId: INEXISTENT }))).rejects.toThrow();
  });

  it('filtra el dashboard per propietari', async () => {
    const propietari = await amb((c) => crearPersona(c, 'propietari', { nom: 'Pere' }));
    await amb((c) => actualitzarPropietat(c, propietatId, { titulars: [{ personaId: propietari.id, percentatge: 100 }] }));

    expect((await amb((c) => obtenirDashboard(c, { propietariId: propietari.id }))).ocupacio.totalUnitats).toBe(1);
    expect((await amb((c) => obtenirDashboard(c, { propietariId: randomUUID() }))).ocupacio.totalUnitats).toBe(0);
  });

  it('gestiona usuaris i tenants inexistents', async () => {
    expect(await obtenirTenantConfig(INEXISTENT)).toBeNull();
    expect(await canviarEstatUsuari(tenantId, INEXISTENT, false)).toBe(false);
    await actualitzarTenantConfig(tenantId, { nom: 'Sense dades', jwtExpiracioMinuts: 60 });
    expect(await obtenirTenantConfig(tenantId)).toMatchObject({ nif: '', adreca: '' });
  });
});
