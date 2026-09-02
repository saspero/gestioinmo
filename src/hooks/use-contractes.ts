// Hooks React Query del mòdul Contractes. Contracte real: src/app/api/contractes/**
// (Agent API Engineer) + src/lib/validations/contractes.ts.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildQueryString, type PaginationParams } from './api-client';
import { pagamentsKeys } from './use-pagaments';

export interface Contracte {
  id: string;
  unitatId: string;
  tipusUs: string;
  dataInici: string;
  dataFi: string | null;
  renda: string;
  fianca: string;
  indexActualitzacio: string;
  percentatgePactat: string | null;
  estat: string;
  documentUrl: string | null;
  motiuResolucio: string | null;
  dataResolucio: string | null;
  createdAt: string;
  updatedAt: string;
  // Present només al GET/POST de detall (docs/api contractes/route.ts): ids dels
  // inquilins associats a la taula pivot `contracte_inquilins`.
  inquilinsIds: string[];
}

export interface ContractesFilters extends PaginationParams {
  estat?: 'esborrany' | 'actiu' | 'finalitzat' | 'resolt';
  unitatId?: string;
  tipusUs?: string;
}

export interface CrearContracteInput {
  unitatId: string;
  tipusUs?: string;
  dataInici: string;
  dataFi?: string;
  renda: number;
  fianca: number;
  indexActualitzacio?: string;
  percentatgePactat?: number;
  documentUrl?: string;
  inquilinsIds: string[];
}

export interface ActualitzarContracteInput {
  dataFi?: string;
  renda?: number;
  fianca?: number;
  indexActualitzacio?: string;
  percentatgePactat?: number;
  documentUrl?: string;
  estat?: 'esborrany' | 'actiu' | 'finalitzat';
}

export interface ResoldreContracteInput {
  motiuResolucio: string;
  dataResolucio: string;
}

export const contractesKeys = {
  all: ['contractes'] as const,
  lists: () => [...contractesKeys.all, 'list'] as const,
  list: (filters: ContractesFilters) => [...contractesKeys.lists(), filters] as const,
  details: () => [...contractesKeys.all, 'detail'] as const,
  detail: (id: string) => [...contractesKeys.details(), id] as const,
};

export function useListContractes(filters: ContractesFilters = {}) {
  return useQuery({
    queryKey: contractesKeys.list(filters),
    queryFn: () => apiFetch<Contracte[]>(`/api/contractes${buildQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

export function useContracte(id: string | undefined) {
  return useQuery({
    queryKey: contractesKeys.detail(id ?? ''),
    queryFn: () => apiFetch<Contracte>(`/api/contractes/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateContracte() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearContracteInput) =>
      apiFetch<Contracte>('/api/contractes', { method: 'POST', body: JSON.stringify(input) }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractesKeys.lists() });
    },
  });
}

// Sense optimistic update: activar/tancar un contracte pot xocar amb la unicitat de
// contracte actiu per unitat (docs/agents/AGENT_STATE.md §4, exemple explícit) -> cal
// esperar la resposta del servidor.
export function useUpdateContracte(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualitzarContracteInput) =>
      apiFetch<Contracte>(`/api/contractes/${id}`, { method: 'PATCH', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: contractesKeys.lists() });
    },
  });
}

export function useDeleteContracte() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/contractes/${id}`, { method: 'DELETE' }).then((res) => res.data),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: contractesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: contractesKeys.lists() });
    },
  });
}

/** POST /api/contractes/[id]/resoldre — regla de negoci: només un contracte `actiu` es
 *  pot resoldre (409 en cas contrari), per això sense optimistic update. */
export function useResoldreContracte(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResoldreContracteInput) =>
      apiFetch<Contracte>(`/api/contractes/${id}/resoldre`, { method: 'POST', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: contractesKeys.lists() });
      // Invalidació encreuada (AGENT_STATE.md §3.3): resoldre un contracte deixa
      // d'alliberar nous rebuts futurs sobre aquest contracte; qualsevol llistat de
      // pagaments filtrat per aquest `contracteId` ha de refrescar-se.
      queryClient.invalidateQueries({ queryKey: pagamentsKeys.lists() });
    },
  });
}
