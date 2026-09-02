// Client fetch compartit per tots els hooks de React Query d'aquest directori.
// Centralitza l'enviament de la cookie de sessió i el parseig de l'envelope
// `{ data, meta } | { error }` (docs/architecture.md §5.1). Cap hook fa `fetch` directe
// fora d'aquesta funció (docs/agents/AGENT_STATE.md, rol).

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

// Missatge genèric quan `code` és INTERNAL_ERROR: mai es mostra el detall cru del
// servidor a l'usuari (docs/agents/AGENT_STATE.md §6).
const GENERIC_ERROR_MESSAGE = "S'ha produït un error inesperat. Torna-ho a provar més tard.";

export class ApiFetchError extends Error {
  code: ApiErrorCode;
  fields?: Record<string, string>;

  constructor(code: ApiErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiFetchError';
    this.code = code;
    this.fields = fields;
  }
}

interface ApiSuccessEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

interface ApiErrorEnvelope {
  error: { code: ApiErrorCode; message: string; fields?: Record<string, string> };
}

export interface ApiFetchResult<T> {
  data: T;
  meta?: ApiMeta;
}

/** Crida `app/api/**`, envia la cookie httpOnly de sessió i llença `ApiFetchError` amb
 *  el `code`/`message`/`fields` de l'envelope d'error en cas de resposta no-2xx. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<ApiFetchResult<T>> {
  const response = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });

  const body = (await response.json().catch(() => null)) as ApiSuccessEnvelope<T> | ApiErrorEnvelope | null;

  if (!response.ok || !body || 'error' in body) {
    const errorInfo = body && 'error' in body ? body.error : null;
    const code: ApiErrorCode = errorInfo?.code ?? 'INTERNAL_ERROR';
    const message = code === 'INTERNAL_ERROR' ? GENERIC_ERROR_MESSAGE : errorInfo?.message ?? GENERIC_ERROR_MESSAGE;
    throw new ApiFetchError(code, message, errorInfo?.fields);
  }

  return { data: body.data, meta: body.meta };
}

/** Construeix la query string d'un llistat, ometent claus buides/`undefined` (els
 *  schemas Zod de `llistar[Recurs]QuerySchema` tracten l'absència igual que el buit).
 *  Accepta qualsevol interfície de filtres del mòdul (`object`, no `Record<string, ...>`,
 *  perquè les interfícies amb propietats opcionals no tenen signatura d'índex). */
export function buildQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | boolean | undefined][]) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
