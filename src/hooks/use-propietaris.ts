// Hooks React Query del mòdul Propietaris. Contracte real: src/app/api/propietaris/**
// + src/app/api/propietats/[id]/titulars + src/lib/validations/persones.ts.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, buildQueryString, type PaginationParams } from './api-client';

export interface Propietari {
  id: string;
  nom: string;
  cognoms: string | null;
  nif: string | null;
  email: string | null;
  telefon: string | null;
  iban: string | null;
  adreca: string | null;
  notes: string | null;
  personaJuridica: boolean;
  representantNom: string | null;
  representantNif: string | null;
  representantCarrec: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropietatDePropietari {
  propietatId: string;
  referencia: string;
  adreca: string;
  percentatge: number;
}

export interface TitularPropietat {
  personaId: string;
  nom: string;
  percentatge: number;
}

export interface PropietarisFilters extends PaginationParams {
  q?: string;
}

export interface PropietariInput {
  personaJuridica?: boolean;
  nom: string;
  cognoms?: string;
  nif?: string;
  email?: string;
  telefon?: string;
  iban?: string;
  adreca?: string;
  notes?: string;
  representantNom?: string;
  representantNif?: string;
  representantCarrec?: string;
}

export const propietarisKeys = {
  all: ['propietaris'] as const,
  lists: () => [...propietarisKeys.all, 'list'] as const,
  list: (filters: PropietarisFilters) => [...propietarisKeys.lists(), filters] as const,
  details: () => [...propietarisKeys.all, 'detail'] as const,
  detail: (id: string) => [...propietarisKeys.details(), id] as const,
  propietats: (id: string) => [...propietarisKeys.detail(id), 'propietats'] as const,
  titulars: (propietatId: string) => [...propietarisKeys.all, 'titulars', propietatId] as const,
};

export function useListPropietaris(filters: PropietarisFilters = {}) {
  return useQuery({
    queryKey: propietarisKeys.list(filters),
    queryFn: () => apiFetch<Propietari[]>(`/api/propietaris${buildQueryString(filters)}`),
    placeholderData: keepPreviousData,
  });
}

export function usePropietari(id: string) {
  return useQuery({
    queryKey: propietarisKeys.detail(id),
    queryFn: () => apiFetch<Propietari>(`/api/propietaris/${id}`).then((res) => res.data),
  });
}

export function usePropietatsDePropietari(id: string) {
  return useQuery({
    queryKey: propietarisKeys.propietats(id),
    queryFn: () => apiFetch<PropietatDePropietari[]>(`/api/propietaris/${id}/propietats`).then((res) => res.data),
  });
}

export function useTitularsPropietat(propietatId: string | undefined) {
  return useQuery({
    queryKey: propietarisKeys.titulars(propietatId ?? ''),
    queryFn: () => apiFetch<TitularPropietat[]>(`/api/propietats/${propietatId}/titulars`).then((res) => res.data),
    enabled: !!propietatId,
  });
}

export function useCreatePropietari() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PropietariInput) =>
      apiFetch<Propietari>('/api/propietaris', { method: 'POST', body: JSON.stringify(input) }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propietarisKeys.lists() });
    },
  });
}

export function useUpdatePropietari(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PropietariInput) =>
      apiFetch<Propietari>(`/api/propietaris/${id}`, { method: 'PATCH', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propietarisKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: propietarisKeys.lists() });
    },
  });
}

export function useDeletePropietari() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/propietaris/${id}`, { method: 'DELETE' }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propietarisKeys.lists() });
    },
  });
}

/** Substitueix tots els titulars d'una propietat: el trigger diferit exigeix que sumin 100%. */
export function useDesarTitulars() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      propietatId,
      titulars,
    }: {
      propietatId: string;
      titulars: Array<{ personaId: string; percentatge: number }>;
    }) =>
      apiFetch(`/api/propietats/${propietatId}`, { method: 'PATCH', body: JSON.stringify({ titulars }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propietarisKeys.all });
    },
  });
}
