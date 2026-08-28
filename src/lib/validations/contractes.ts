import { z } from 'zod';
import { paginationQuerySchema, uuidSchema, dateStringSchema } from './common';

export const tipusUsContracteEnum = z.enum(['habitatge', 'local', 'parking', 'industrial', 'altres']);
export const estatContracteEnum = z.enum(['esborrany', 'actiu', 'finalitzat', 'resolt']);

export const crearContracteSchema = z
  .object({
    unitatId: uuidSchema,
    tipusUs: tipusUsContracteEnum.default('habitatge'),
    dataInici: dateStringSchema,
    dataFi: dateStringSchema.optional(),
    renda: z.number().positive(),
    fianca: z.number().nonnegative(),
    indexActualitzacio: z.string().trim().min(1).default('IPC'),
    percentatgePactat: z.number().optional(),
    documentUrl: z.string().trim().url().optional(),
    inquilinsIds: z.array(uuidSchema).min(1, 'Cal indicar almenys un inquilí'),
  })
  // docs/requirements.md, regla de negoci #4: fiança 1-2 mensualitats només per a
  // habitatge; altres usos es pacten lliurement (docs/db-schema.md §5,
  // `contractes_check_fianca_habitatge`) — es valida també aquí per donar un error 400
  // amb el camp exacte en lloc d'esperar el 409 de la BD.
  .superRefine((data, ctx) => {
    if (data.tipusUs === 'habitatge' && (data.fianca < data.renda || data.fianca > data.renda * 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fianca'],
        message: "Per a contractes d'habitatge, la fiança ha d'estar entre una i dues mensualitats.",
      });
    }
    if (data.dataFi && data.dataFi <= data.dataInici) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dataFi'],
        message: "La data de fi ha de ser posterior a la data d'inici.",
      });
    }
  });
export type CrearContracte = z.infer<typeof crearContracteSchema>;

export const actualitzarContracteSchema = z.object({
  dataFi: dateStringSchema.optional(),
  renda: z.number().positive().optional(),
  fianca: z.number().nonnegative().optional(),
  indexActualitzacio: z.string().trim().min(1).optional(),
  percentatgePactat: z.number().optional(),
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
