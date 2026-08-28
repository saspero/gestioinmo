// Envelope estàndard de resposta d'API (docs/architecture.md §5.1-5.2). Únic lloc que
// construeix `data`/`error`: cap route handler ho fa a mà (docs/agents/AGENT_API.md §5).

import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export interface ApiMeta {
  page: number;
  pageSize: number;
  total: number;
}

const HTTP_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export function apiSuccess<T>(data: T, meta?: ApiMeta, status = 200): NextResponse {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status });
}

export function apiError(code: ApiErrorCode, message: string, fields?: Record<string, string>): NextResponse {
  return NextResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status: HTTP_STATUS[code] });
}
