// @vitest-environment node
//
// Integració contra PostgreSQL real: els errors que cobreix (extensions per tenant,
// paràmetres no tipats, triggers diferits) no es poden detectar amb `pg` mockejat.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { hashPassword } from '@/lib/auth/password';
import {
  canviarContrasenya,
  createSession,
  isSessionActive,
  login,
  reemetreSessio,
  renovarSessio,
  revokeAllSessions,
  revokeSession,
} from '@/lib/auth/session';
import { withTenantContext } from '@/lib/auth/tenant-context';
import { verifyToken } from '@/lib/auth/jwt';
import { getDomainPool } from '@/lib/db/pool';
import {
  actualitzarPersona,
  crearPersona,
  donarBaixaPersona,
  llistarPersones,
  obtenirPersona,
} from '@/lib/db/persones';
import {
  actualitzarPropietat,
  crearPropietat,
  llistarPropietatsDePropietari,
  llistarTitulars,
} from '@/lib/db/propietats';
import {
  completarDocument,
  crearDocument,
  desarPartDocument,
  entitatExisteix,
  esborrarDocument,
  llegirPartDocument,
  llistarDocuments,
} from '@/lib/db/documents';
import { obtenirContextUsuari, provisionarTenant } from '@/lib/db/tenants';
import {
  actualitzarTenantConfig,
  canviarEstatUsuari,
  crearUsuari,
  llistarUsuaris,
  obtenirTenantConfig,
  restablirContrasenyaUsuari,
} from '@/lib/db/usuaris';
import { actualitzarPersonaSchema } from '@/lib/validations/persones';
import { actualitzarPropietatSchema, crearPropietatSchema } from '@/lib/validations/propietats';
import { MIDA_PART_DOCUMENT, midaPartDocument } from '@/lib/validations/documents';
import { crearBdTest } from '../helpers/test-db';

const adminUrl = process.env.TEST_DATABASE_URL;
const PASSWORD = 'contrasenya-de-prova';
const QUERY = { page: 1, pageSize: 20, order: 'asc' as const };

describe.skipIf(!adminUrl)('multitenancy amb PostgreSQL real', () => {
  let eliminar: () => Promise<void>;
  let tenantA: string;
  let tenantB: string;
  let sessioA: { tenant_id: string; sub: string };
  let sessioB: { tenant_id: string; sub: string };

  const comA = <T,>(fn: (client: PoolClient) => Promise<T>) => withTenantContext(sessioA, fn);
  const comB = <T,>(fn: (client: PoolClient) => Promise<T>) => withTenantContext(sessioB, fn);

  async function idUsuari(email: string): Promise<string> {
    const { rows } = await getDomainPool().query('SELECT id FROM public.tenant_users WHERE email = $1', [email]);
    return rows[0].id;
  }

  beforeAll(async () => {
    const bd = await crearBdTest(adminUrl!);
    eliminar = bd.eliminar;
    process.env.DATABASE_URL_DEV = bd.url;

    const admin = (email: string) => ({ email, nom: 'Admin', password: PASSWORD });
    tenantA = (await provisionarTenant({ nom: 'Agència A', slug: 'a', admin: admin('a@test.cat') })).tenantId;
    tenantB = (await provisionarTenant({ nom: 'Agència B', slug: 'b', admin: admin('b@test.cat') })).tenantId;
    sessioA = { tenant_id: tenantA, sub: await idUsuari('a@test.cat') };
    sessioB = { tenant_id: tenantB, sub: await idUsuari('b@test.cat') };
  }, 60_000);

  afterAll(async () => {
    await getDomainPool().end();
    await eliminar();
  });

  it('provisiona el segon tenant i reutilitza un slug existent', async () => {
    expect(tenantB).not.toBe(tenantA);
    const repetit = await provisionarTenant({
      nom: 'Ignorat',
      slug: 'a',
      admin: { email: 'a2@test.cat', nom: 'Segon', password: PASSWORD },
    });
    expect(repetit).toEqual({ tenantId: tenantA, tenantNou: false });
  });

  it('xifra, desxifra i llista persones a cada tenant', async () => {
    const persona = await comB((c) => crearPersona(c, 'propietari', { nom: 'Marta', nif: '12345678Z', iban: 'ES12' }));
    expect(persona).toMatchObject({ nom: 'Marta', nif: '12345678Z', iban: 'ES12' });

    const { data, meta } = await comB((c) => llistarPersones(c, 'propietari', QUERY));
    expect(data).toHaveLength(1);
    expect(meta.total).toBe(1);

    const filtrat = await comB((c) => llistarPersones(c, 'propietari', { ...QUERY, q: 'cap-coincidencia' }));
    expect(filtrat.meta.total).toBe(0);

    const actualitzada = await comB((c) => actualitzarPersona(c, persona.id, 'propietari', { telefon: '600' }));
    expect(actualitzada?.telefon).toBe('600');

    // `null` esborra el camp (també els xifrats); un camp absent no es toca.
    const buidada = await comB((c) =>
      actualitzarPersona(c, persona.id, 'propietari', actualitzarPersonaSchema.parse({ telefon: null, iban: null }))
    );
    expect(buidada).toMatchObject({ telefon: null, iban: null, nif: '12345678Z' });
  });

  it('desa persones jurídiques amb representant i en neteja els camps en canviar de tipus', async () => {
    const empresa = await comA((c) =>
      crearPersona(c, 'inquili', {
        personaJuridica: true,
        nom: 'Lloguers SL',
        cognoms: 'ignorat',
        nif: 'B12345678',
        representantNom: 'Joan Puig',
        representantNif: '87654321X',
        representantCarrec: 'Administrador únic',
      })
    );
    expect(empresa).toMatchObject({
      personaJuridica: true,
      cognoms: null,
      nif: 'B12345678',
      representantNom: 'Joan Puig',
      representantNif: '87654321X',
      representantCarrec: 'Administrador únic',
    });

    // Una física mai guarda representant, encara que el rebi.
    const fisica = await comA((c) => crearPersona(c, 'inquili', { nom: 'Pere', representantNom: 'Ningú' }));
    expect(fisica).toMatchObject({ personaJuridica: false, representantNom: null });

    const aFisica = await comA((c) =>
      actualitzarPersona(c, empresa.id, 'inquili', { personaJuridica: false, cognoms: 'Lloguers', representantNom: 'x' })
    );
    expect(aFisica).toMatchObject({ personaJuridica: false, cognoms: 'Lloguers', representantNom: null, representantNif: null });

    const aJuridica = await comA((c) =>
      actualitzarPersona(c, empresa.id, 'inquili', { personaJuridica: true, cognoms: 'x', representantCarrec: 'Apoderat' })
    );
    expect(aJuridica).toMatchObject({ personaJuridica: true, cognoms: null, representantCarrec: 'Apoderat' });

    // Editar un altre camp no la torna a física.
    const editada = await comA((c) => actualitzarPersona(c, empresa.id, 'inquili', { telefon: '930000000' }));
    expect(editada?.personaJuridica).toBe(true);
  });

  it("no deixa veure ni escriure dades d'un altre tenant", async () => {
    const persona = await comA((c) => crearPersona(c, 'propietari', { nom: 'Només A' }));
    expect(await comB((c) => obtenirPersona(c, persona.id, 'propietari'))).toBeNull();
    expect(await comB((c) => donarBaixaPersona(c, persona.id, 'propietari'))).toBe(false);
    expect(await comA((c) => obtenirPersona(c, persona.id, 'propietari'))).not.toBeNull();
  });

  it('desa els camps propis de parkings i solars', async () => {
    const parking = await comA((c) =>
      crearPropietat(
        c,
        crearPropietatSchema.parse({
          referencia: 'PK-1',
          tipus: 'parking',
          adreca: 'Major 3',
          referenciaCadastral: '1234567AB1234C0001XY',
          superficie: 12.5,
          numeroPlaca: '42',
          planta: '-1',
          habitacions: 2,
        })
      )
    );
    expect(parking).toMatchObject({
      tipus: 'parking',
      referenciaCadastral: '1234567AB1234C0001XY',
      numeroPlaca: '42',
      planta: '-1',
      habitacions: null,
    });

    const solar = await comA((c) =>
      crearPropietat(
        c,
        crearPropietatSchema.parse({
          referencia: 'SOL-1',
          tipus: 'solar',
          adreca: 'Camí',
          superficie: 1000,
          superficieEdificable: 400,
          tipusSol: 'rustic',
        })
      )
    );
    expect(solar).toMatchObject({ tipus: 'solar', tipusSol: 'rustic', ascensor: false });
    expect(Number(solar.superficieEdificable)).toBe(400);
  });

  it('en editar, esborra camps buidats i els del tipus anterior', async () => {
    const pis = await comA((c) =>
      crearPropietat(
        c,
        crearPropietatSchema.parse({
          referencia: 'PIS-ED',
          tipus: 'pis',
          adreca: 'Major 5',
          referenciaCadastral: '9999999AB1234C0001XY',
          habitacions: 3,
          ascensor: true,
        })
      )
    );

    const parking = await comA((c) =>
      actualitzarPropietat(
        c,
        pis.id,
        actualitzarPropietatSchema.parse({ tipus: 'parking', numeroPlaca: '7', referenciaCadastral: null })
      )
    );
    expect(parking).toMatchObject({
      tipus: 'parking',
      numeroPlaca: '7',
      referenciaCadastral: null,
      habitacions: null,
      ascensor: false,
      adreca: 'Major 5',
    });
  });

  it('exigeix que els titulars sumin 100% i conserva la resta de camps', async () => {
    const pere = await comA((c) => crearPersona(c, 'propietari', { nom: 'Pere' }));
    const anna = await comA((c) => crearPersona(c, 'propietari', { nom: 'Anna' }));
    const propietat = await comA((c) =>
      crearPropietat(c, crearPropietatSchema.parse({ referencia: 'P-1', tipus: 'edifici', adreca: 'Major', ascensor: true }))
    );

    await expect(
      comA((c) =>
        actualitzarPropietat(
          c,
          propietat.id,
          actualitzarPropietatSchema.parse({ titulars: [{ personaId: pere.id, percentatge: 60 }] })
        )
      )
    ).rejects.toThrow(/100/);

    const desada = await comA((c) =>
      actualitzarPropietat(
        c,
        propietat.id,
        actualitzarPropietatSchema.parse({
          titulars: [
            { personaId: pere.id, percentatge: 70 },
            { personaId: anna.id, percentatge: 30 },
          ],
        })
      )
    );
    expect(desada).toMatchObject({ tipus: 'edifici', ascensor: true });

    const titulars = await comA((c) => llistarTitulars(c, propietat.id));
    expect(titulars.map((t) => t.percentatge).sort()).toEqual([30, 70]);
    expect(await comA((c) => llistarPropietatsDePropietari(c, pere.id))).toMatchObject([
      { referencia: 'P-1', percentatge: 70 },
    ]);

    await expect(comA((c) => donarBaixaPersona(c, pere.id, 'propietari'))).rejects.toThrow(/propietats associades/);

    // Treure un titular: la resta ha de tornar a sumar 100%.
    await comA((c) =>
      actualitzarPropietat(
        c,
        propietat.id,
        actualitzarPropietatSchema.parse({ titulars: [{ personaId: pere.id, percentatge: 100 }] })
      )
    );
    expect(await comA((c) => llistarTitulars(c, propietat.id))).toMatchObject([{ personaId: pere.id, percentatge: 100 }]);
    expect(await comA((c) => llistarPropietatsDePropietari(c, anna.id))).toEqual([]);
    // Ja sense propietats, es pot donar de baixa.
    expect(await comA((c) => donarBaixaPersona(c, anna.id, 'propietari'))).toBe(true);

    // L'últim titular no es pot treure.
    await expect(
      comA((c) => actualitzarPropietat(c, propietat.id, actualitzarPropietatSchema.parse({ titulars: [] })))
    ).rejects.toThrow(/100/);
  });

  describe('login', () => {
    it('accepta les credencials correctes i registra la sessió', async () => {
      const result = await login('b@test.cat', PASSWORD, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.tenant_id).toBe(tenantB);
      expect(await isSessionActive(result.payload.jti)).toBe(true);

      await revokeSession(result.payload.jti);
      expect(await isSessionActive(result.payload.jti)).toBe(false);
    });

    it("no distingeix un usuari inexistent d'una contrasenya incorrecta", async () => {
      expect(await login('ningu@test.cat', PASSWORD)).toEqual({ ok: false, reason: 'invalid_credentials' });
      expect(await login('b@test.cat', 'incorrecta')).toEqual({ ok: false, reason: 'invalid_credentials' });
    });

    it('bloqueja després de 5 intents, encara que la contrasenya sigui bona', async () => {
      await crearUsuari(tenantA, { email: 'lock@test.cat', nom: 'Lock', rol: 'gestor' }, await hashDe('a@test.cat'));
      for (let i = 0; i < 5; i += 1) await login('lock@test.cat', 'incorrecta');
      expect(await login('lock@test.cat', PASSWORD)).toMatchObject({ ok: false, reason: 'account_locked' });
    }, 30_000);

    it('només revela que un compte està desactivat amb la contrasenya correcta', async () => {
      await crearUsuari(tenantA, { email: 'off@test.cat', nom: 'Off', rol: 'gestor' }, await hashDe('a@test.cat'));
      const id = await idUsuari('off@test.cat');
      expect(await canviarEstatUsuari(tenantA, id, false)).toBe(true);

      expect(await login('off@test.cat', PASSWORD)).toEqual({ ok: false, reason: 'account_disabled' });
      expect(await login('off@test.cat', 'incorrecta')).toEqual({ ok: false, reason: 'invalid_credentials' });
      expect(await obtenirContextUsuari(tenantA, id)).toBeNull();
    });

    it('revoca totes les sessions d’un usuari', async () => {
      const { token } = await createSession({ id: sessioB.sub, tenantId: tenantB, rol: 'admin' }, {}, 60);
      const payload = await verifyToken(token);
      await revokeAllSessions(sessioB.sub);
      expect(await isSessionActive(payload!.jti)).toBe(false);
    });

    it('canvia la contrasenya si l’actual és correcta i només conserva la sessió que la canvia', async () => {
      await crearUsuari(tenantA, { email: 'canvi@test.cat', nom: 'Canvi', rol: 'gestor' }, await hashDe('a@test.cat'));
      const id = await idUsuari('canvi@test.cat');
      const actual = await login('canvi@test.cat', PASSWORD);
      const altra = await login('canvi@test.cat', PASSWORD);
      if (!actual.ok || !altra.ok) throw new Error('El login de preparació ha fallat.');
      // Creat per un administrador: la contrasenya és temporal.
      expect(actual.payload.canvi_contrasenya).toBe(true);

      expect(await canviarContrasenya(id, 'incorrecta', 'nova-contrasenya', actual.payload.jti)).toBe('contrasenya_incorrecta');
      expect(await canviarContrasenya(id, PASSWORD, 'nova-contrasenya', actual.payload.jti)).toBe('ok');

      expect(await isSessionActive(actual.payload.jti)).toBe(true);
      expect(await isSessionActive(altra.payload.jti)).toBe(false);
      expect(await login('canvi@test.cat', PASSWORD)).toEqual({ ok: false, reason: 'invalid_credentials' });
      const despres = await login('canvi@test.cat', 'nova-contrasenya');
      if (!despres.ok) throw new Error('El login amb la contrasenya nova ha fallat.');
      expect(despres.payload.canvi_contrasenya).toBeUndefined();

      // La sessió que portava l'indicador se substitueix per una de neta.
      const reemesa = await reemetreSessio(actual.payload, {});
      expect((await verifyToken(reemesa.token))?.canvi_contrasenya).toBeUndefined();
      expect(await isSessionActive(actual.payload.jti)).toBe(false);
    });

    it('renova una sessió activa amb el mateix jti i rebutja les revocades o de comptes desactivats', async () => {
      const { token } = await createSession({ id: sessioB.sub, tenantId: tenantB, rol: 'admin' }, {}, 1);
      const payload = (await verifyToken(token))!;

      const renovada = await renovarSessio(payload);
      expect(renovada).not.toBeNull();
      const nou = (await verifyToken(renovada!.token))!;
      expect(nou.jti).toBe(payload.jti);
      // La sessió d'1 minut s'allarga fins a l'expiració configurada al tenant.
      const { jwtExpiracioMinuts } = (await obtenirTenantConfig(tenantB))!;
      expect(nou.exp - nou.iat).toBe(jwtExpiracioMinuts * 60);
      expect(renovada!.expiresAt.getTime()).toBeGreaterThan(Date.now() + (jwtExpiracioMinuts - 1) * 60_000);
      expect(await isSessionActive(payload.jti)).toBe(true);

      await revokeSession(payload.jti);
      expect(await renovarSessio(payload)).toBeNull();

      await crearUsuari(tenantA, { email: 'renova@test.cat', nom: 'Renova', rol: 'gestor' }, await hashDe('a@test.cat'));
      const id = await idUsuari('renova@test.cat');
      const altra = await createSession({ id, tenantId: tenantA, rol: 'gestor' }, {}, 60);
      await canviarEstatUsuari(tenantA, id, false);
      expect(await renovarSessio((await verifyToken(altra.token))!)).toBeNull();
    });

    it("l'administrador de l'alta només ha de canviar la contrasenya si era generada", async () => {
      const result = await login('a@test.cat', PASSWORD);
      if (!result.ok) throw new Error('El login de preparació ha fallat.');
      expect(result.payload.canvi_contrasenya).toBeUndefined();
    });
  });

  describe('configuració', () => {
    it("desa les dades de l'agència sense perdre la resta de configuració", async () => {
      await getDomainPool().query(`UPDATE public.tenants SET configuracio = '{"altre": 1}' WHERE id = $1`, [tenantB]);
      await actualitzarTenantConfig(tenantB, { nom: 'Nova', nif: 'B1', adreca: undefined, jwtExpiracioMinuts: 30 });

      expect(await obtenirTenantConfig(tenantB)).toEqual({ nom: 'Nova', nif: 'B1', adreca: '', jwtExpiracioMinuts: 30 });
      const { rows } = await getDomainPool().query('SELECT configuracio FROM public.tenants WHERE id = $1', [tenantB]);
      expect(rows[0].configuracio.altre).toBe(1);
    });

    it('rebutja un email en ús a qualsevol tenant', async () => {
      await expect(
        crearUsuari(tenantB, { email: 'a@test.cat', nom: 'Dup', rol: 'gestor' }, 'hash')
      ).rejects.toThrow('ja està en ús');
    });

    it("no permet canviar l'estat d'un usuari d'un altre tenant", async () => {
      expect(await canviarEstatUsuari(tenantB, sessioA.sub, false)).toBe(false);
      expect((await llistarUsuaris(tenantB)).every((usuari) => usuari.id !== sessioA.sub)).toBe(true);
    });
  });

  describe('restabliment de contrasenya', () => {
    it('posa la contrasenya nova i desbloqueja el compte, només dins el mateix tenant', async () => {
      await crearUsuari(tenantA, { email: 'reset@test.cat', nom: 'Reset', rol: 'gestor' }, await hashPassword('una-altra-123'));
      const id = await idUsuari('reset@test.cat');
      for (let i = 0; i < 5; i += 1) await login('reset@test.cat', 'incorrecta');

      expect(await restablirContrasenyaUsuari(tenantB, id, await hashDe('a@test.cat'))).toBe(false);
      expect(await restablirContrasenyaUsuari(tenantA, id, await hashDe('a@test.cat'))).toBe(true);
      expect(await login('reset@test.cat', PASSWORD)).toMatchObject({ ok: true, payload: { canvi_contrasenya: true } });
    });
  });

  async function hashDe(email: string): Promise<string> {
    const { rows } = await getDomainPool().query('SELECT password_hash FROM public.tenant_users WHERE email = $1', [email]);
    return rows[0].password_hash;
  }
  it('desa documents xifrats en trossos, els torna sencers i no es veuen des d\'un altre tenant', async () => {
    const propietat = await comA((c) =>
      crearPropietat(c, crearPropietatSchema.parse({ referencia: 'DOC-1', tipus: 'pis', adreca: 'Major 9' }))
    );
    expect(await comA((c) => entitatExisteix(c, 'propietat', propietat.id))).toBe(true);
    expect(await comB((c) => entitatExisteix(c, 'propietat', propietat.id))).toBe(false);

    const mida = MIDA_PART_DOCUMENT * 2 + 1234;
    const fitxer = Buffer.alloc(mida);
    for (let i = 0; i < mida; i++) fitxer[i] = (i * 7) % 251;

    const document = await comA((c) =>
      crearDocument(
        c,
        { entitat: 'propietat', entitatId: propietat.id, nom: 'escriptura.pdf', mime: 'application/pdf', mida },
        sessioA.sub
      )
    );
    expect(document).toMatchObject({ parts: 3, pujatPer: 'Admin' });

    const tros = (idx: number) =>
      fitxer.subarray(idx * MIDA_PART_DOCUMENT, idx * MIDA_PART_DOCUMENT + midaPartDocument(mida, idx));
    await comA((c) => desarPartDocument(c, document.id, 0, tros(0)));
    await comA((c) => desarPartDocument(c, document.id, 2, tros(2)));

    // A mitges, no surt al llistat i no es pot completar.
    expect(await comA((c) => llistarDocuments(c, 'propietat', propietat.id))).toHaveLength(0);
    await expect(comA((c) => completarDocument(c, document.id))).rejects.toThrow('Encara no ha arribat');

    await comA((c) => desarPartDocument(c, document.id, 1, tros(1)));
    await comA((c) => completarDocument(c, document.id));
    expect(await comA((c) => llistarDocuments(c, 'propietat', propietat.id))).toMatchObject([
      { id: document.id, nom: 'escriptura.pdf', mida },
    ]);

    const llegit = Buffer.concat(
      await comA(async (c) => [
        (await llegirPartDocument(c, document.id, 0))!,
        (await llegirPartDocument(c, document.id, 1))!,
        (await llegirPartDocument(c, document.id, 2))!,
      ])
    );
    expect(llegit.equals(fitxer)).toBe(true);

    // Es guarda xifrat: el contingut en clar no apareix a la taula.
    const { rows } = await comA((c) =>
      c.query<{ dades_enc: Buffer }>('SELECT dades_enc FROM document_parts WHERE document_id = $1 AND idx = 0', [
        document.id,
      ])
    );
    expect(rows[0].dades_enc.includes(tros(0).subarray(0, 64))).toBe(false);

    // L'altre tenant no el veu.
    expect(await comB((c) => llistarDocuments(c, 'propietat', propietat.id))).toHaveLength(0);

    expect(await comA((c) => esborrarDocument(c, document.id))).toBe(true);
    const parts = await comA((c) => c.query('SELECT 1 FROM document_parts WHERE document_id = $1', [document.id]));
    expect(parts.rowCount).toBe(0);
  });
});
