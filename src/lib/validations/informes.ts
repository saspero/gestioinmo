import { z } from 'zod';
import { uuidSchema, dateStringSchema } from './common';

export const dashboardQuerySchema = z.object({
  dataInici: dateStringSchema.optional(),
  dataFi: dateStringSchema.optional(),
  propietatId: uuidSchema.optional(),
  propietariId: uuidSchema.optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const recursExportEnum = z.enum(['propietats', 'propietaris', 'inquilins', 'contractes', 'pagaments', 'incidencies']);
export type RecursExport = z.infer<typeof recursExportEnum>;

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'pdf']),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
