// Hooks React Query del mòdul Inquilins. Contracte real: src/app/api/inquilins/**
// (Agent API Engineer) + src/lib/validations/persones.ts.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildQueryString, type PaginationParams } from './api-client';

export interface Inquili {
  id: string;
  tipus: 'propietari' | 'inquili' | 'empresa';
  nom: string;
  cognoms: string | null;
  nif: string | null;
  email: string | null;
  telefon: string | null;
  iban: string | null;
  adreca: string | null;
  notes: string | null;
  estatInquili: 'actiu' | 'moros' | 'inactiu' | null;
  createdAt: string;
  updatedAt: string;
}

export interface InquilinsFilters extends PaginationParams {
  q?: string;
  estatInquili?: 'actiu' | 'moros' | 'inactiu';
}

export interface CrearInquiliInput {
  nom: string;
  cognoms?: string;
  nif?: string;
  email?: string;
  telefon?: string;
  iban?: string;
  adreca?: string;
  notes?: string;
}

export type ActualitzarInquiliInput = Partial<CrearInquiliInput>;

export const inquilinsKeys = {
  all: ['inquilins'] as const,
  lists: () => [...inquilinsKeys.all, 'list'] as const,
  list: (filters: InquilinsFilters) => [...inquilinsKeys.lists(), filters] as const,
  details: () => [...inquilinsKeys.all, 'detail'] as const,
  detail: (id: string) => [...inquilinsKeys.details(), id] as const,
};

export function useListInquilins(filters: InquilinsFilters = {}) {
  return useQuery({
    queryKey: inquilinsKeys.list(filters),
    queryFn: () => apiFetch<Inquili[]>(`/api/inquilins${buildQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

export function useInquili(id: string | undefined) {
  return useQuery({
    queryKey: inquilinsKeys.detail(id ?? ''),
    queryFn: () => apiFetch<Inquili>(`/api/inquilins/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateInquili() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearInquiliInput) =>
      apiFetch<Inquili>('/api/inquilins', { method: 'POST', body: JSON.stringify(input) }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inquilinsKeys.lists() });
    },
  });
}

export function useUpdateInquili(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ActualitzarInquiliInput) =>
      apiFetch<Inquili>(`/api/inquilins/${id}`, { method: 'PATCH', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inquilinsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: inquilinsKeys.lists() });
    },
  });
}

export function useDeleteInquili() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/inquilins/${id}`, { method: 'DELETE' }).then((res) => res.data),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: inquilinsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: inquilinsKeys.lists() });
    },
  });
}
