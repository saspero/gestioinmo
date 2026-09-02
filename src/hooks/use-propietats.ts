// Hooks React Query del mòdul Propietats. Contracte real: src/app/api/propietats/**
// (Agent API Engineer) + src/lib/validations/propietats.ts.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildQueryString, type PaginationParams } from './api-client';

export interface Titular {
  personaId: string;
  percentatge: number;
}

export interface Propietat {
  id: string;
  referencia: string;
  tipus: string;
  adreca: string;
  poblacio: string | null;
  cp: string | null;
  superficie: string | null;
  habitacions: number | null;
  banys: number | null;
  ascensor: boolean;
  certEnergetic: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropietatsFilters extends PaginationParams {
  tipus?: string;
  poblacio?: string;
  q?: string;
}

export interface CrearPropietatInput {
  referencia: string;
  tipus?: string;
  adreca: string;
  poblacio?: string;
  cp?: string;
  superficie?: number;
  habitacions?: number;
  banys?: number;
  ascensor?: boolean;
  certEnergetic?: string;
  notes?: string;
  titulars?: Titular[];
}

export type ActualitzarPropietatInput = Partial<CrearPropietatInput>;

// Factory de claus de caché del mòdul: cap hook en construeix una manualment
// (docs/agents/AGENT_STATE.md §1).
export const propietatsKeys = {
  all: ['propietats'] as const,
  lists: () => [...propietatsKeys.all, 'list'] as const,
  list: (filters: PropietatsFilters) => [...propietatsKeys.lists(), filters] as const,
  details: () => [...propietatsKeys.all, 'detail'] as const,
  detail: (id: string) => [...propietatsKeys.details(), id] as const,
};

export function useListPropietats(filters: PropietatsFilters = {}) {
  return useQuery({
    queryKey: propietatsKeys.list(filters),
    queryFn: () => apiFetch<Propietat[]>(`/api/propietats${buildQueryString(filters)}`),
    placeholderData: keepPreviousData,
    // Catàleg de propietats: canvia poc (AGENT_STATE.md §5) -> staleTime més alt que el
    // per defecte de query-client.ts.
    staleTime: 120_000,
  });
}

export function usePropietat(id: string | undefined) {
  return useQuery({
    queryKey: propietatsKeys.detail(id ?? ''),
    queryFn: () => apiFetch<Propietat>(`/api/propietats/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreatePropietat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearPropietatInput) =>
      apiFetch<Propietat>('/api/propietats', { method: 'POST', body: JSON.stringify(input) }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propietatsKeys.lists() });
    },
  });
}

// Sense optimistic update: l'edició de propietats no és una acció d'alta freqüència i
// pot incloure `titulars` (percentatges de titularitat), validats per un trigger diferit
// a BD (docs/agents/AGENT_STATE.md §4) -> s'espera la resposta del servidor.
export function useUpdatePropietat(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualitzarPropietatInput) =>
      apiFetch<Propietat>(`/api/propietats/${id}`, { method: 'PATCH', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propietatsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: propietatsKeys.lists() });
    },
  });
}

export function useDeletePropietat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/propietats/${id}`, { method: 'DELETE' }).then((res) => res.data),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: propietatsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: propietatsKeys.lists() });
    },
  });
}
