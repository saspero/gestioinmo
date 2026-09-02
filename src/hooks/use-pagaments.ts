// Hooks React Query del mòdul Pagaments. Contracte real: src/app/api/pagaments/**
// (Agent API Engineer) + src/lib/validations/pagaments.ts.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildQueryString, type PaginationParams } from './api-client';
import { inquilinsKeys } from './use-inquilins';

export interface Pagament {
  id: string;
  contracteId: string;
  remesaId: string | null;
  concepte: string;
  import: string;
  dataVenciment: string;
  dataCobrament: string | null;
  metode: string | null;
  estat: 'pendent' | 'remesa' | 'cobrat' | 'vencut' | 'mora' | 'regularitzat';
  createdAt: string;
  updatedAt: string;
}

export interface PagamentsFilters extends PaginationParams {
  estat?: Pagament['estat'];
  contracteId?: string;
  remesaId?: string;
}

export interface CrearPagamentInput {
  contracteId: string;
  concepte?: string;
  import: number;
  dataVenciment: string;
}

export interface ActualitzarPagamentInput {
  concepte?: string;
  dataVenciment?: string;
}

export interface CobrarPagamentInput {
  dataCobrament: string;
  metode: 'domiciliacio' | 'transferencia' | 'efectiu' | 'targeta' | 'altres';
}

export interface CrearRemesaInput {
  referencia: string;
  pagamentsIds: string[];
  dataEnviament?: string;
}

export interface Remesa {
  id: string;
  referencia: string;
  dataEnviament: string | null;
  createdAt: string;
}

export const pagamentsKeys = {
  all: ['pagaments'] as const,
  lists: () => [...pagamentsKeys.all, 'list'] as const,
  list: (filters: PagamentsFilters) => [...pagamentsKeys.lists(), filters] as const,
  details: () => [...pagamentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...pagamentsKeys.details(), id] as const,
};

export function useListPagaments(filters: PagamentsFilters = {}) {
  return useQuery({
    queryKey: pagamentsKeys.list(filters),
    queryFn: () => apiFetch<Pagament[]>(`/api/pagaments${buildQueryString(filters)}`),
    placeholderData: keepPreviousData,
    // Rebuts/mora canvien sovint (AGENT_STATE.md §5) -> staleTime més curt que el
    // per defecte de query-client.ts.
    staleTime: 15_000,
  });
}

export function usePagament(id: string | undefined) {
  return useQuery({
    queryKey: pagamentsKeys.detail(id ?? ''),
    queryFn: () => apiFetch<Pagament>(`/api/pagaments/${id}`).then((res) => res.data),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreatePagament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearPagamentInput) =>
      apiFetch<Pagament>('/api/pagaments', { method: 'POST', body: JSON.stringify(input) }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pagamentsKeys.lists() });
    },
  });
}

export function useUpdatePagament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualitzarPagamentInput) =>
      apiFetch<Pagament>(`/api/pagaments/${id}`, { method: 'PATCH', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pagamentsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: pagamentsKeys.lists() });
    },
  });
}

// DELETE /api/pagaments/[id] anul·la el rebut (docs/lib/db/pagaments.ts `anularPagament`).
export function useDeletePagament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/pagaments/${id}`, { method: 'DELETE' }).then((res) => res.data),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: pagamentsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: pagamentsKeys.lists() });
      // Invalidació encreuada: anul·lar un rebut pot canviar l'estat de mora de
      // l'inquilí (mateix motiu que `useCobrarPagament`, vegeu comentari sota).
      queryClient.invalidateQueries({ queryKey: inquilinsKeys.lists() });
    },
  });
}

/** POST /api/pagaments/[id]/cobrar — acció d'ús freqüent i baixa taxa de conflicte:
 *  optimistic update amb rollback (docs/agents/AGENT_STATE.md §4, patró de referència). */
export function useCobrarPagament(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CobrarPagamentInput) =>
      apiFetch<Pagament>(`/api/pagaments/${id}/cobrar`, { method: 'POST', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: pagamentsKeys.detail(id) });
      const previous = queryClient.getQueryData<Pagament>(pagamentsKeys.detail(id));
      queryClient.setQueryData<Pagament>(pagamentsKeys.detail(id), (old) =>
        old ? { ...old, estat: 'cobrat' } : old
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(pagamentsKeys.detail(id), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pagamentsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: pagamentsKeys.lists() });
      // Invalidació encreuada (AGENT_STATE.md §3.3): cobrar un rebut pot fer que
      // l'inquilí deixi de tenir rebuts pendents i que `estatInquili` passi de 'moros' a
      // 'actiu' -> el llistat d'inquilins ha de refrescar-se.
      queryClient.invalidateQueries({ queryKey: inquilinsKeys.lists() });
    },
  });
}

/** POST /api/pagaments/remeses — agrupa rebuts existents; sense optimistic update
 *  perquè afecta múltiples rebuts alhora. */
export function useCreateRemesaPagaments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearRemesaInput) =>
      apiFetch<Remesa>('/api/pagaments/remeses', { method: 'POST', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      // Els rebuts inclosos a la remesa canvien d'estat ('pendent' -> 'remesa').
      queryClient.invalidateQueries({ queryKey: pagamentsKeys.lists() });
    },
  });
}
