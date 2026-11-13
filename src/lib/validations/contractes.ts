import { z } from 'zod';
import { paginationQuerySchema, uuidSchema, dateStringSchema } from './common';

export const tipusUsContracteEnum = z.enum(['habitatge', 'local', 'parking', 'industrial', 'altres']);
export const estatContracteEnum = z.enum(['esborrany', 'actiu', 'finalitzat', 'resolt']);
export const tipusActualitzacioEnum = z.enum(['ipc', 'irav', 'percentatge_fix', 'cap']);
export const tipusGarantiaEnum = z.enum(['aval_bancari', 'diposit_addicional', 'asseguranca_impagament', 'altres']);
export const tipusConcepteEnum = z.enum(['renda', 'escombraries', 'comunitat', 'ibi', 'subministraments', 'altres']);
export const periodicitatConcepteEnum = z.enum(['mensual', 'anual']);
export type TipusActualitzacio = z.infer<typeof tipusActualitzacioEnum>;

const mesos = z.number().int().positive();

/** Pactes del contracte que no porten historial: es poden corregir en qualsevol moment. */
const pactesShape = {
  tipusActualitzacio: tipusActualitzacioEnum,
  percentatgePactat: z.number().min(0).max(100),
  duradaMesos: mesos,
  prorrogaAutomatica: z.boolean(),
  prorrogaMesos: mesos,
  duradaMaximaMesos: mesos,
  preavisDies: z.number().int().nonnegative(),
  moblat: z.boolean(),
};

/** Suma `n` mesos a una data `YYYY-MM-DD`; si el dia no existeix, queda a final de mes. */
export function sumarMesos(data: string, n: number): string {
  const [any, mes, dia] = data.split('-').map(Number);
  const total = any * 12 + (mes - 1) + n;
  const anyNou = Math.floor(total / 12);
  const mesNou = (total % 12) + 1;
  const diesMes = new Date(Date.UTC(anyNou, mesNou, 0)).getUTCDate();
  const diaNou = Math.min(dia, diesMes);
  return `${anyNou}-${String(mesNou).padStart(2, '0')}-${String(diaNou).padStart(2, '0')}`;
}

export const crearContracteSchema = z
  .object({
    unitatId: uuidSchema,
    tipusUs: tipusUsContracteEnum.default('habitatge'),
    dataInici: dateStringSchema,
    dataFi: dateStringSchema.optional(),
    renda: z.number().positive(),
    fianca: z.number().nonnegative().optional(),
    indexActualitzacio: z.string().trim().min(1).optional(),
    tipusActualitzacio: pactesShape.tipusActualitzacio.default('ipc'),
    percentatgePactat: pactesShape.percentatgePactat.optional(),
    duradaMesos: pactesShape.duradaMesos.optional(),
    prorrogaAutomatica: pactesShape.prorrogaAutomatica.default(false),
    prorrogaMesos: pactesShape.prorrogaMesos.optional(),
    duradaMaximaMesos: pactesShape.duradaMaximaMesos.optional(),
    preavisDies: pactesShape.preavisDies.optional(),
    moblat: pactesShape.moblat.default(false),
    documentUrl: z.string().trim().url().optional(),
    inquilinsIds: z.array(uuidSchema).min(1, 'Cal indicar almenys un inquilí'),
  })
  .superRefine((data, ctx) => {
    if (data.dataFi && data.dataFi <= data.dataInici) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataFi'],
        message: "La data de fi ha de ser posterior a la data d'inici.",
      });
    }
    if (data.tipusActualitzacio === 'percentatge_fix' && data.percentatgePactat === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['percentatgePactat'],
        message: 'Indica el percentatge pactat.',
      });
    }
    if (data.duradaMaximaMesos !== undefined && data.duradaMesos !== undefined && data.duradaMaximaMesos < data.duradaMesos) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['duradaMaximaMesos'],
        message: 'La durada màxima no pot ser inferior a la durada inicial.',
      });
    }
  })
  // docs/requirements.md, regla de negoci #4: la fiança es pacta lliurement; si no
  // s'indica, és una mensualitat de la renda inicial. Amb una durada i sense data de fi,
  // la fi de la durada inicial es calcula.
  .transform((data) => ({
    ...data,
    fianca: data.fianca ?? data.renda,
    dataFi: data.dataFi ?? (data.duradaMesos ? fiDePeriode(data.dataInici, data.duradaMesos) : undefined),
    indexActualitzacio: data.indexActualitzacio ?? data.tipusActualitzacio.toUpperCase(),
  }));
export type CrearContracte = z.infer<typeof crearContracteSchema>;

// En editar, `null` esborra un pacte opcional i un camp absent el deixa com estava. La
// renda d'un contracte actiu no es canvia aquí: es registra com a concepte amb data
// d'efecte (`modificarConcepteSchema`).
export const actualitzarContracteSchema = z.object({
  dataFi: dateStringSchema.optional(),
  renda: z.number().positive().optional(),
  fianca: z.number().nonnegative().optional(),
  indexActualitzacio: z.string().trim().min(1).optional(),
  tipusActualitzacio: pactesShape.tipusActualitzacio.optional(),
  percentatgePactat: pactesShape.percentatgePactat.nullable().optional(),
  duradaMesos: pactesShape.duradaMesos.nullable().optional(),
  prorrogaAutomatica: pactesShape.prorrogaAutomatica.optional(),
  prorrogaMesos: pactesShape.prorrogaMesos.nullable().optional(),
  duradaMaximaMesos: pactesShape.duradaMaximaMesos.nullable().optional(),
  preavisDies: pactesShape.preavisDies.nullable().optional(),
  moblat: pactesShape.moblat.optional(),
  documentUrl: z.string().trim().url().optional(),
  estat: z.enum(['esborrany', 'actiu', 'finalitzat']).optional(),
});
export type ActualitzarContracte = z.infer<typeof actualitzarContracteSchema>;

export const resoldreContracteSchema = z.object({
  motiuResolucio: z.string().trim().min(1, 'El motiu és obligatori'),
  dataResolucio: dateStringSchema,
});
export type ResoldreContracte = z.infer<typeof resoldreContracteSchema>;

export const llistarContractesQuerySchema = paginationQuerySchema.extend({
  estat: estatContracteEnum.optional(),
  unitatId: uuidSchema.optional(),
  tipusUs: tipusUsContracteEnum.optional(),
});
export type LlistarContractesQuery = z.infer<typeof llistarContractesQuerySchema>;

// --- Conceptes (renda i despeses repercutides) ---

const importSchema = z.number().positive("L'import ha de ser més gran que zero");

/** Una despesa nova. La renda no s'afegeix: la té tot contracte des de l'alta. */
export const crearConcepteSchema = z
  .object({
    tipus: tipusConcepteEnum.exclude(['renda']),
    descripcio: z.string().trim().max(200).optional(),
    import: importSchema,
    periodicitat: periodicitatConcepteEnum.default('mensual'),
    mesCobrament: z.number().int().min(1).max(12).optional(),
    vigentDesDe: dateStringSchema,
  })
  .superRefine((data, ctx) => {
    if (data.periodicitat === 'mensual' && data.mesCobrament !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mesCobrament'], message: 'Només una despesa anual té mes de cobrament.' });
    }
    if (data.tipus === 'altres' && !data.descripcio) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['descripcio'], message: 'Descriu de quina despesa es tracta.' });
    }
  });
export type CrearConcepte = z.infer<typeof crearConcepteSchema>;

/** Nou import d'un concepte (també la renda) a partir d'una data. */
export const modificarConcepteSchema = z.object({
  import: importSchema,
  dataEfecte: dateStringSchema,
  motiu: z.string().trim().max(200).optional(),
});
export type ModificarConcepte = z.infer<typeof modificarConcepteSchema>;

/** Deixa de cobrar una despesa a partir d'una data (l'últim dia vigent és el dia abans). */
export const baixaConcepteSchema = z.object({
  dataEfecte: dateStringSchema,
});
export type BaixaConcepte = z.infer<typeof baixaConcepteSchema>;

// --- Garanties ---

export const crearGarantiaSchema = z.object({
  tipus: tipusGarantiaEnum,
  import: z.number().nonnegative().optional(),
  entitat: z.string().trim().max(200).optional(),
  dataVenciment: dateStringSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type CrearGarantia = z.infer<typeof crearGarantiaSchema>;

/** Suma (o resta) dies a una data `YYYY-MM-DD`. */
export function sumarDies(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Últim dia d'un període de `mesos` que comença el dia `inici` (de l'1/1 a 12 mesos: el 31/12). */
export function fiDePeriode(inici: string, mesos: number): string {
  return sumarDies(sumarMesos(inici, mesos), -1);
}

/**
 * Últim dia del període vigent del contracte (inicial o pròrroga), o `null` si no té ni
 * data de fi ni durada. Amb pròrroga automàtica, cada període s'allarga `prorrogaMesos`
 * fins a la durada màxima.
 */
export function properVenciment(
  contracte: {
    dataInici: string;
    dataFi: string | null;
    duradaMesos: number | null;
    prorrogaAutomatica: boolean;
    prorrogaMesos: number | null;
    duradaMaximaMesos: number | null;
  },
  avui: string
): string | null {
  const { dataInici, dataFi, duradaMesos, prorrogaMesos, duradaMaximaMesos } = contracte;
  const fiInicial = dataFi ?? (duradaMesos ? fiDePeriode(dataInici, duradaMesos) : null);
  if (!fiInicial) return null;
  if (!contracte.prorrogaAutomatica || !prorrogaMesos || fiInicial >= avui) return fiInicial;

  // Es compta sempre des de l'inici (o des de la fi inicial) per no arrossegar l'ajust
  // de final de mes d'una pròrroga a la següent.
  const fiDespresDe = (k: number) =>
    duradaMesos ? fiDePeriode(dataInici, duradaMesos + k * prorrogaMesos) : fiDePeriode(sumarDies(fiInicial, 1), k * prorrogaMesos);
  const limit = duradaMaximaMesos ? fiDePeriode(dataInici, duradaMaximaMesos) : null;

  let fi = fiInicial;
  for (let k = 1; fi < avui && k <= 1200; k++) {
    const seguent = fiDespresDe(k);
    if (limit && seguent >= limit) return limit > fi ? limit : fi;
    fi = seguent;
  }
  return fi;
}
