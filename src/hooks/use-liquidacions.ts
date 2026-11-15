// Hooks React Query de les liquidacions als propietaris. Contracte real:
// src/app/api/liquidacions/** + src/lib/validations/liquidacions.ts.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildQueryString, type PaginationParams } from './api-client';

export interface Liquidacio {
  id: string;
  propietariId: string;
  propietariNom: string;
  periodeInici: string;
  periodeFi: string;
  totalCobrat: string;
  totalDespeses: string;
  comissioAgencia: string;
  ivaComissio: string;
  netALiquidar: string;
  dataPagament: string | null;
  generatEl: string;
  /** Només al detall. */
  linies?: LiniaLiquidacio[];
}

export interface LiniaLiquidacio {
  id: string;
  tipus: 'cobrament' | 'despesa';
  propietatId: string;
  pagamentId: string | null;
  despesaId: string | null;
  data: string;
  descripcio: string;
  importTotal: string;
  percentatge: string;
  import: string;
  baseComissio: string;
  comissio: string;
  iva: string;
}

export interface LiquidacionsFilters extends PaginationParams {
  propietariId?: string;
}

export interface GenerarLiquidacionsInput {
  periodeInici: string;
  periodeFi: string;
  propietariId?: string;
}

export const liquidacionsKeys = {
  all: ['liquidacions'] as const,
  lists: () => [...liquidacionsKeys.all, 'list'] as const,
  list: (filters: LiquidacionsFilters) => [...liquidacionsKeys.lists(), filters] as const,
  detail: (id: string) => [...liquidacionsKeys.all, 'detail', id] as const,
};

export function useListLiquidacions(filters: LiquidacionsFilters = {}) {
  return useQuery({
    queryKey: liquidacionsKeys.list(filters),
    queryFn: () => apiFetch<Liquidacio[]>(`/api/liquidacions${buildQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

export function useLiquidacio(id: string) {
  return useQuery({
    queryKey: liquidacionsKeys.detail(id),
    queryFn: () => apiFetch<Liquidacio>(`/api/liquidacions/${id}`).then((res) => res.data),
  });
}

export function useGenerarLiquidacions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerarLiquidacionsInput) =>
      apiFetch<Liquidacio[]>('/api/liquidacions', { method: 'POST', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liquidacionsKeys.lists() }),
  });
}

export function usePagarLiquidacio(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dataPagament: string) =>
      apiFetch<Liquidacio>(`/api/liquidacions/${id}/pagar`, {
        method: 'POST',
        body: JSON.stringify({ dataPagament }),
      }).then((res) => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liquidacionsKeys.all }),
  });
}

export function useEsborrarLiquidacio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/liquidacions/${id}`, { method: 'DELETE' }).then((res) => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liquidacionsKeys.lists() }),
  });
}
