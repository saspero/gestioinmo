// Hooks React Query del mòdul Incidències. Contracte real: src/app/api/incidencies/**
// (Agent API Engineer) + src/lib/validations/incidencies.ts.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildQueryString, type PaginationParams } from './api-client';
import { despesesKeys } from './use-despeses';

export type EstatIncidencia = 'oberta' | 'assignada' | 'en_curs' | 'resolta';
export type PrioritatIncidencia = 'baixa' | 'normal' | 'alta' | 'urgent';

export interface Incidencia {
  id: string;
  unitatId: string;
  contracteId: string | null;
  reportadorId: string | null;
  titol: string;
  descripcio: string | null;
  prioritat: PrioritatIncidencia;
  estat: EstatIncidencia;
  assignatA: string | null;
  costEstimat: string | null;
  costFinal: string | null;
  resoltaEl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comentari {
  id: string;
  incidenciaId: string;
  autorId: string;
  text: string;
  createdAt: string;
}

export interface IncidenciesFilters extends PaginationParams {
  estat?: EstatIncidencia;
  prioritat?: PrioritatIncidencia;
  unitatId?: string;
  assignatA?: string;
}

export interface CrearIncidenciaInput {
  unitatId: string;
  contracteId?: string;
  reportadorId?: string;
  titol: string;
  descripcio?: string;
  prioritat?: PrioritatIncidencia;
}

// L'estat 'resolta' només s'assoleix via `useResoldreIncidencia` (docs/agents,
// src/lib/validations/incidencies.ts: no es pot reobrir un cop resolta).
export interface ActualitzarIncidenciaInput {
  titol?: string;
  descripcio?: string;
  prioritat?: PrioritatIncidencia;
  estat?: 'oberta' | 'assignada' | 'en_curs';
  assignatA?: string;
  costEstimat?: number;
  costFinal?: number;
}

export interface ResoldreIncidenciaInput {
  costFinal?: number;
}

export interface CrearComentariInput {
  text: string;
}

export const incidenciesKeys = {
  all: ['incidencies'] as const,
  lists: () => [...incidenciesKeys.all, 'list'] as const,
  list: (filters: IncidenciesFilters) => [...incidenciesKeys.lists(), filters] as const,
  details: () => [...incidenciesKeys.all, 'detail'] as const,
  detail: (id: string) => [...incidenciesKeys.details(), id] as const,
  comentaris: (id: string) => [...incidenciesKeys.detail(id), 'comentaris'] as const,
};

export function useListIncidencies(filters: IncidenciesFilters = {}) {
  return useQuery({
    queryKey: incidenciesKeys.list(filters),
    queryFn: () => apiFetch<Incidencia[]>(`/api/incidencies${buildQueryString(filters)}`),
    placeholderData: keepPreviousData,
    // Cua d'incidències obertes: canvia sovint (AGENT_STATE.md §5).
    staleTime: 15_000,
  });
}

export function useIncidencia(id: string | undefined) {
  return useQuery({
    queryKey: incidenciesKeys.detail(id ?? ''),
    queryFn: () => apiFetch<Incidencia>(`/api/incidencies/${id}`).then((res) => res.data),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useCreateIncidencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearIncidenciaInput) =>
      apiFetch<Incidencia>('/api/incidencies', { method: 'POST', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidenciesKeys.lists() });
    },
  });
}

/** PATCH /api/incidencies/[id] — optimistic update només per al canvi de camp `estat`
 *  (transició oberta -> assignada -> en_curs): ús freqüent i baixa taxa de conflicte
 *  (docs/agents/AGENT_STATE.md §4). La resta de camps (prioritat, assignació, costos...)
 *  esperen la resposta del servidor. */
export function useUpdateIncidencia(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualitzarIncidenciaInput) =>
      apiFetch<Incidencia>(`/api/incidencies/${id}`, { method: 'PATCH', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onMutate: async (input) => {
      if (!input.estat) return undefined;
      await queryClient.cancelQueries({ queryKey: incidenciesKeys.detail(id) });
      const previous = queryClient.getQueryData<Incidencia>(incidenciesKeys.detail(id));
      queryClient.setQueryData<Incidencia>(incidenciesKeys.detail(id), (old) =>
        old ? { ...old, estat: input.estat! } : old
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(incidenciesKeys.detail(id), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: incidenciesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: incidenciesKeys.lists() });
    },
  });
}

export function useDeleteIncidencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/incidencies/${id}`, { method: 'DELETE' }).then((res) => res.data),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: incidenciesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: incidenciesKeys.lists() });
    },
  });
}

/** POST /api/incidencies/[id]/resoldre — transició terminal (no es pot reobrir, trigger
 *  de BD) -> sense optimistic update, s'espera la resposta del servidor. */
export function useResoldreIncidencia(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResoldreIncidenciaInput) =>
      apiFetch<Incidencia>(`/api/incidencies/${id}/resoldre`, { method: 'POST', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidenciesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: incidenciesKeys.lists() });
      // Invalidació encreuada (AGENT_STATE.md §3.3): resoldre una incidència sol anar
      // seguida de l'alta d'una despesa (`incidenciaId`) amb el cost final -> refresca
      // els llistats de despeses filtrats per aquesta incidència.
      queryClient.invalidateQueries({ queryKey: despesesKeys.lists() });
    },
  });
}

export function useComentarisIncidencia(incidenciaId: string | undefined) {
  return useQuery({
    queryKey: incidenciesKeys.comentaris(incidenciaId ?? ''),
    queryFn: () => apiFetch<Comentari[]>(`/api/incidencies/${incidenciaId}/comentaris`).then((res) => res.data),
    enabled: !!incidenciaId,
  });
}

export function useCreateComentariIncidencia(incidenciaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearComentariInput) =>
      apiFetch<Comentari>(`/api/incidencies/${incidenciaId}/comentaris`, {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: incidenciesKeys.comentaris(incidenciaId) });
    },
  });
}
