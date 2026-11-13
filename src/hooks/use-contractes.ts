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
  /** Renda vigent avui. */
  renda: string;
  rendaInicial: string;
  fianca: string;
  indexActualitzacio: string;
  tipusActualitzacio: TipusActualitzacio;
  percentatgePactat: string | null;
  duradaMesos: number | null;
  prorrogaAutomatica: boolean;
  prorrogaMesos: number | null;
  duradaMaximaMesos: number | null;
  preavisDies: number | null;
  moblat: boolean;
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

export type TipusActualitzacio = 'ipc' | 'irav' | 'percentatge_fix' | 'cap';

export interface CrearContracteInput {
  unitatId: string;
  tipusUs?: string;
  dataInici: string;
  dataFi?: string;
  renda: number;
  fianca: number;
  tipusActualitzacio?: TipusActualitzacio;
  percentatgePactat?: number;
  duradaMesos?: number;
  prorrogaAutomatica?: boolean;
  prorrogaMesos?: number;
  duradaMaximaMesos?: number;
  preavisDies?: number;
  moblat?: boolean;
  documentUrl?: string;
  inquilinsIds: string[];
}

/** En editar, `null` esborra un pacte opcional. */
export interface ActualitzarContracteInput {
  dataFi?: string;
  renda?: number;
  fianca?: number;
  tipusActualitzacio?: TipusActualitzacio;
  percentatgePactat?: number | null;
  duradaMesos?: number | null;
  prorrogaAutomatica?: boolean;
  prorrogaMesos?: number | null;
  duradaMaximaMesos?: number | null;
  preavisDies?: number | null;
  moblat?: boolean;
  documentUrl?: string;
  estat?: 'esborrany' | 'actiu' | 'finalitzat';
}

export type TipusConcepte = 'renda' | 'escombraries' | 'comunitat' | 'ibi' | 'subministraments' | 'altres';

export interface Concepte {
  id: string;
  contracteId: string;
  tipus: TipusConcepte;
  descripcio: string | null;
  import: string;
  periodicitat: 'mensual' | 'anual';
  mesCobrament: number | null;
  vigentDesDe: string;
  vigentFins: string | null;
  substitueixId: string | null;
  motiu: string | null;
  createdAt: string;
}

export interface CrearConcepteInput {
  tipus: Exclude<TipusConcepte, 'renda'>;
  descripcio?: string;
  import: number;
  periodicitat: 'mensual' | 'anual';
  mesCobrament?: number;
  vigentDesDe: string;
}

export interface ModificarConcepteInput {
  import: number;
  dataEfecte: string;
  motiu?: string;
}

export type TipusGarantia = 'aval_bancari' | 'diposit_addicional' | 'asseguranca_impagament' | 'altres';

export interface Garantia {
  id: string;
  contracteId: string;
  tipus: TipusGarantia;
  import: string | null;
  entitat: string | null;
  dataVenciment: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CrearGarantiaInput {
  tipus: TipusGarantia;
  import?: number;
  entitat?: string;
  dataVenciment?: string;
  notes?: string;
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
  conceptes: (id: string) => [...contractesKeys.detail(id), 'conceptes'] as const,
  garanties: (id: string) => [...contractesKeys.detail(id), 'garanties'] as const,
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

// --- Renda i despeses repercutides (historial amb data d'efecte) ---

export function useConceptesContracte(id: string) {
  return useQuery({
    queryKey: contractesKeys.conceptes(id),
    queryFn: () => apiFetch<Concepte[]>(`/api/contractes/${id}/conceptes`).then((res) => res.data),
  });
}

/** Un canvi de renda o de despeses canvia la renda vigent del detall i del llistat. */
function invalidarConceptes(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: contractesKeys.detail(id) });
  queryClient.invalidateQueries({ queryKey: contractesKeys.lists() });
}

export function useCrearConcepte(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearConcepteInput) =>
      apiFetch<Concepte>(`/api/contractes/${id}/conceptes`, { method: 'POST', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => invalidarConceptes(queryClient, id),
  });
}

export function useModificarConcepte(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ concepteId, ...input }: ModificarConcepteInput & { concepteId: string }) =>
      apiFetch<Concepte>(`/api/contractes/${id}/conceptes/${concepteId}/modificar`, {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((res) => res.data),
    onSuccess: () => invalidarConceptes(queryClient, id),
  });
}

export function useBaixaConcepte(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ concepteId, dataEfecte }: { concepteId: string; dataEfecte: string }) =>
      apiFetch<Concepte>(`/api/contractes/${id}/conceptes/${concepteId}/baixa`, {
        method: 'POST',
        body: JSON.stringify({ dataEfecte }),
      }).then((res) => res.data),
    onSuccess: () => invalidarConceptes(queryClient, id),
  });
}

// --- Garanties ---

export function useGarantiesContracte(id: string) {
  return useQuery({
    queryKey: contractesKeys.garanties(id),
    queryFn: () => apiFetch<Garantia[]>(`/api/contractes/${id}/garanties`).then((res) => res.data),
  });
}

export function useCrearGarantia(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearGarantiaInput) =>
      apiFetch<Garantia>(`/api/contractes/${id}/garanties`, { method: 'POST', body: JSON.stringify(input) }).then(
        (res) => res.data
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contractesKeys.garanties(id) }),
  });
}

export function useEsborrarGarantia(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (garantiaId: string) =>
      apiFetch<{ id: string }>(`/api/contractes/${id}/garanties/${garantiaId}`, { method: 'DELETE' }).then(
        (res) => res.data
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contractesKeys.garanties(id) }),
  });
}
