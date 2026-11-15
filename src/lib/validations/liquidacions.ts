import { z } from 'zod';
import { dateStringSchema, paginationQuerySchema, uuidSchema } from './common';

/** IVA de la comissió de l'agència, en percentatge. */
export const IVA_COMISSIO = 21;

/**
 * Genera les liquidacions d'un període: una per propietari amb rebuts cobrats o despeses
 * per liquidar. Amb `propietariId`, només la d'aquell propietari.
 */
export const generarLiquidacionsSchema = z
  .object({
    periodeInici: dateStringSchema,
    periodeFi: dateStringSchema,
    propietariId: uuidSchema.optional(),
  })
  .refine((data) => data.periodeFi >= data.periodeInici, {
    message: "La data de fi no pot ser anterior a la d'inici",
    path: ['periodeFi'],
  });
export type GenerarLiquidacions = z.infer<typeof generarLiquidacionsSchema>;

export const pagarLiquidacioSchema = z.object({ dataPagament: dateStringSchema });
export type PagarLiquidacio = z.infer<typeof pagarLiquidacioSchema>;

export const llistarLiquidacionsQuerySchema = paginationQuerySchema.extend({
  propietariId: uuidSchema.optional(),
});
export type LlistarLiquidacionsQuery = z.infer<typeof llistarLiquidacionsQuerySchema>;

/** Percentatge d'un import, arrodonit a cèntims. */
export function percentDe(importe: number, percentatge: number): number {
  return Math.round(importe * percentatge) / 100;
}

export interface ImportsLinia {
  import: number;
  baseComissio: number;
  comissio: number;
  iva: number;
}

/**
 * Part del propietari d'un rebut cobrat. La comissió es calcula sobre la seva part de
 * renda (no sobre les despeses que retorna l'inquilí) i porta l'IVA de la comissió.
 */
export function importsCobrament(
  importTotal: number,
  rendaTotal: number,
  percentatgePropietari: number,
  percentatgeComissio: number
): ImportsLinia {
  const baseComissio = percentDe(rendaTotal, percentatgePropietari);
  const comissio = percentDe(baseComissio, percentatgeComissio);
  return {
    import: percentDe(importTotal, percentatgePropietari),
    baseComissio,
    comissio,
    iva: percentDe(comissio, IVA_COMISSIO),
  };
}
