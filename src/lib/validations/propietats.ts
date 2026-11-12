import { z } from 'zod';
import { paginationQuerySchema, uuidSchema } from './common';

export const tipusPropietatEnum = z.enum(['edifici', 'casa', 'pis', 'local', 'parking', 'solar', 'altres']);
export const estatUnitatEnum = z.enum(['vacant', 'ocupat', 'reservat', 'manteniment', 'baixa']);

// Copropietat (docs/requirements.md 3.3): el % de titularitat s'acaba validant a BD
// (trigger diferit `trg_check_percentatge_titularitat`, docs/db-schema.md §3.7) — aquí
// només es valida el format de cada fila.
export const titularSchema = z.object({
  personaId: uuidSchema,
  percentatge: z.number().gt(0).lte(100),
});

export const tipusSolEnum = z.enum(['rural', 'rustic', 'urbanitzable']);
export type TipusPropietat = z.infer<typeof tipusPropietatEnum>;

/** Camps que depenen del tipus. Adreça, població, CP i referència cadastral els tenen tots. */
export type CampPerTipus =
  | 'superficie'
  | 'habitacions'
  | 'banys'
  | 'ascensor'
  | 'certEnergetic'
  | 'numeroPlaca'
  | 'planta'
  | 'numPisos'
  | 'superficieEdificable'
  | 'tipusSol';

// El certificat energètic no apareix a la llista de camps per tipus, però es manté en
// els tipus habitables o d'ús on la normativa l'exigeix per llogar.
export const CAMPS_PER_TIPUS: Record<TipusPropietat, readonly CampPerTipus[]> = {
  pis: ['superficie', 'habitacions', 'banys', 'ascensor', 'certEnergetic'],
  casa: ['superficie', 'habitacions', 'banys', 'ascensor', 'certEnergetic'],
  parking: ['superficie', 'numeroPlaca', 'planta'],
  edifici: ['superficie', 'ascensor', 'numPisos', 'certEnergetic'],
  local: ['superficie', 'banys', 'ascensor', 'certEnergetic'],
  solar: ['superficie', 'superficieEdificable', 'tipusSol'],
  altres: ['superficie'],
};

/**
 * Tipus que es lloguen sencers: en donar-los d'alta es crea sola la seva única unitat.
 * Un edifici en pot tenir diverses i les afegeix el gestor.
 */
export function teUnitatUnica(tipus: string): boolean {
  return tipus !== 'edifici';
}

const TOTS_ELS_CAMPS_PER_TIPUS: readonly CampPerTipus[] = [
  'superficie',
  'habitacions',
  'banys',
  'ascensor',
  'certEnergetic',
  'numeroPlaca',
  'planta',
  'numPisos',
  'superficieEdificable',
  'tipusSol',
];

const basePropietatSchema = z.object({
  referencia: z.string().trim().min(1, 'La referència és obligatòria'),
  tipus: tipusPropietatEnum.default('pis'),
  adreca: z.string().trim().min(1, "L'adreça és obligatòria"),
  poblacio: z.string().trim().optional(),
  cp: z.string().trim().optional(),
  referenciaCadastral: z.string().trim().optional(),
  superficie: z.number().positive().optional(),
  habitacions: z.number().int().nonnegative().optional(),
  banys: z.number().int().nonnegative().optional(),
  ascensor: z.boolean().default(false),
  certEnergetic: z.string().trim().optional(),
  numeroPlaca: z.string().trim().optional(),
  planta: z.string().trim().optional(),
  numPisos: z.number().int().positive().optional(),
  superficieEdificable: z.number().nonnegative().optional(),
  tipusSol: tipusSolEnum.optional(),
  notes: z.string().trim().optional(),
  titulars: z.array(titularSchema).optional(),
});

/** En una alta es descarten els camps que no corresponen al tipus triat. */
export const crearPropietatSchema = basePropietatSchema.transform((data) => {
  const propis = CAMPS_PER_TIPUS[data.tipus];
  const net = { ...data };
  for (const camp of TOTS_ELS_CAMPS_PER_TIPUS) {
    if (!propis.includes(camp)) delete net[camp];
  }
  return { ...net, ascensor: propis.includes('ascensor') ? data.ascensor : false };
});
export type CrearPropietat = z.infer<typeof crearPropietatSchema>;

const opcionalEsborrable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();
const base = basePropietatSchema.shape;

// En editar, `null` vol dir "esborra aquest camp" i un camp absent, "no el toquis".
// Zod 4 aplica `.default()` encara que el camp sigui opcional: sense redefinir `tipus` i
// `ascensor`, qualsevol PATCH parcial els reescriuria amb el valor per defecte.
const actualitzarPropietatBaseSchema = basePropietatSchema.partial().extend({
  tipus: tipusPropietatEnum.optional(),
  ascensor: z.boolean().optional(),
  poblacio: opcionalEsborrable(base.poblacio.unwrap()),
  cp: opcionalEsborrable(base.cp.unwrap()),
  referenciaCadastral: opcionalEsborrable(base.referenciaCadastral.unwrap()),
  superficie: opcionalEsborrable(base.superficie.unwrap()),
  habitacions: opcionalEsborrable(base.habitacions.unwrap()),
  banys: opcionalEsborrable(base.banys.unwrap()),
  certEnergetic: opcionalEsborrable(base.certEnergetic.unwrap()),
  numeroPlaca: opcionalEsborrable(base.numeroPlaca.unwrap()),
  planta: opcionalEsborrable(base.planta.unwrap()),
  numPisos: opcionalEsborrable(base.numPisos.unwrap()),
  superficieEdificable: opcionalEsborrable(base.superficieEdificable.unwrap()),
  tipusSol: opcionalEsborrable(tipusSolEnum),
  notes: opcionalEsborrable(base.notes.unwrap()),
});

/** Si canvia el tipus, s'esborren els camps que el tipus nou no té. */
export const actualitzarPropietatSchema = actualitzarPropietatBaseSchema.transform((data) => {
  if (data.tipus === undefined) return data;
  const propis = CAMPS_PER_TIPUS[data.tipus];
  const net = { ...data };
  for (const camp of TOTS_ELS_CAMPS_PER_TIPUS) {
    if (propis.includes(camp)) continue;
    if (camp === 'ascensor') net.ascensor = false;
    else net[camp] = null;
  }
  return net;
});
export type ActualitzarPropietat = z.infer<typeof actualitzarPropietatSchema>;

export const llistarPropietatsQuerySchema = paginationQuerySchema.extend({
  tipus: tipusPropietatEnum.optional(),
  poblacio: z.string().trim().optional(),
  q: z.string().trim().optional(),
});
export type LlistarPropietatsQuery = z.infer<typeof llistarPropietatsQuerySchema>;

export const crearUnitatSchema = z.object({
  referencia: z.string().trim().min(1, 'La referència és obligatòria'),
  planta: z.string().trim().optional(),
  porta: z.string().trim().optional(),
  superficie: z.number().positive().optional(),
  rendaBase: z.number().nonnegative().optional(),
});
export type CrearUnitat = z.infer<typeof crearUnitatSchema>;

export const actualitzarUnitatSchema = crearUnitatSchema.partial().extend({
  estat: estatUnitatEnum.optional(),
});
export type ActualitzarUnitat = z.infer<typeof actualitzarUnitatSchema>;
