// Hooks React Query del mòdul Despeses. Contracte real: src/app/api/despeses/**
// (Agent API Engineer) + src/lib/validations/despeses.ts.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildQueryString, type PaginationParams } from './api-client';

export type CategoriaDespesa =
  | 'manteniment'
  | 'subministraments'
  | 'assegurances'
  | 'impostos'
  | 'comunitat'
  | 'gestoria'
  | 'altres';

export interface Despesa {
  id: string;
  propietatId: string;
  unitatId: string | null;
  incidenciaId: string | null;
  categoria: CategoriaDespesa;
  concepte: string;
  import: string;
  dataDespesa: string;
  proveidor: string | null;
  facturaUrl: string | null;
  repercutiblePropietari: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DespesesFilters extends PaginationParams {
  propietatId?: string;
  unitatId?: string;
  incidenciaId?: string;
  categoria?: CategoriaDespesa;
  dataInici?: string;
  dataFi?: string;
}

export interface CrearDespesaInput {
  propietatId: string;
  unitatId?: string;
  incidenciaId?: string;
  categoria?: CategoriaDespesa;
  concepte: string;
  import: number;
  dataDespesa: string;
  proveidor?: string;
  facturaUrl?: string;
  repercutiblePropietari?: boolean;
  notes?: string;
}

// `propietatId` no s'admet a l'actualització: és l'ancoratge de la despesa, no es
// reassigna un cop creada (src/lib/validations/despeses.ts, comentari original).
export type ActualitzarDespesaInput = Partial<Omit<CrearDespesaInput, 'propietatId'>>;

export const despesesKeys = {
  all: ['despeses'] as const,
  lists: () => [...despesesKeys.all, 'list'] as const,
  list: (filters: DespesesFilters) => [...despesesKeys.lists(), filters] as const,
  details: () => [...despesesKeys.all, 'detail'] as const,
  detail: (id: string) => [...despesesKeys.details(), id] as const,
};

export function useListDespeses(filters: DespesesFilters = {}) {
  return useQuery({
    queryKey: despesesKeys.list(filters),
    queryFn: () => apiFetch<Despesa[]>(`/api/despeses${buildQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

export function useDespesa(id: string | undefined) {
  return useQuery({
    queryKey: despesesKeys.detail(id ?? ''),
    queryFn: () => apiFetch<Despesa>(`/api/despeses/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateDespesa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearDespesaInput) =>
      apiFetch<Despesa>('/api/despeses', { method: 'POST', body: JSON.stringify(input) }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: despesesKeys.lists() });
    },
  });
}

export function useUpdateDespesa(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualitzarDespesaInput) =>
      apiFetch<Despesa>(`/api/despeses/${id}`, { method: 'PATCH', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: despesesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: despesesKeys.lists() });
    },
  });
}

export function useDeleteDespesa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/despeses/${id}`, { method: 'DELETE' }).then((res) => res.data),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: despesesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: despesesKeys.lists() });
    },
  });
}
