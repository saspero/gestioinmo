// Envoltori d'errors compartit per tots els route handlers (src/app/api/**): centralitza
// la traducció d'excepcions a l'envelope `docs/architecture.md` §5.1, perquè cap handler
// repeteixi el mateix `try/catch` (docs/agents/AGENT_API.md §5/§8).

import type { NextResponse } from 'next/server';
import { apiError } from '../../../lib/errors';
import { translatePgError } from '../../../lib/db/pg-error';
import { BusinessRuleError } from '../../../lib/db/business-error';
import { logger } from '../../../lib/logger';

export async function runHandler(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof BusinessRuleError) {
      return apiError('CONFLICT', error.message);
    }

    const pgMessage = translatePgError(error);
    if (pgMessage) {
      return apiError('CONFLICT', pgMessage);
    }

    logger.error('Error inesperat en un route handler', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('INTERNAL_ERROR', "S'ha produït un error inesperat.");
  }
}
