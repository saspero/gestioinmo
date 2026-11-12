// Hooks React Query dels documents adjunts. Contracte real: src/app/api/documents/**.
// Els fitxers viatgen en trossos (MIDA_PART_DOCUMENT): una funció de Vercel no accepta
// ni retorna més de 4,5 MB per petició.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiFetchBinary, ApiFetchError } from './api-client';
import {
  MIDA_MAXIMA_DOCUMENT,
  tipusDocument,
  type EntitatDocument,
} from '@/lib/validations/documents';

export interface Document {
  id: string;
  entitat: EntitatDocument;
  entitatId: string;
  nom: string;
  mime: string;
  mida: number;
  parts: number;
  pujatPer: string | null;
  createdAt: string;
}

interface DocumentCreat extends Document {
  midaPart: number;
}

export const documentsKeys = {
  all: ['documents'] as const,
  lists: () => [...documentsKeys.all, 'list'] as const,
  list: (entitat: EntitatDocument, entitatId: string) => [...documentsKeys.lists(), entitat, entitatId] as const,
};

export function useListDocuments(entitat: EntitatDocument, entitatId: string) {
  return useQuery({
    queryKey: documentsKeys.list(entitat, entitatId),
    queryFn: () =>
      apiFetch<Document[]>(`/api/documents?entitat=${entitat}&entitatId=${encodeURIComponent(entitatId)}`).then(
        (res) => res.data
      ),
  });
}

/** Comprovacions que es fan abans d'enviar res, perquè l'error surti a l'instant. */
export function errorFitxer(fitxer: File): string | undefined {
  if (fitxer.size === 0) return 'El fitxer és buit.';
  if (fitxer.size > MIDA_MAXIMA_DOCUMENT) return 'El fitxer no pot fer més de 10 MB.';
  if (!tipusDocument(fitxer.name, fitxer.type)) {
    return 'Tipus de fitxer no admès. Puja un PDF, una imatge o un document de text o full de càlcul.';
  }
  return undefined;
}

async function pujarDocument(entitat: EntitatDocument, entitatId: string, fitxer: File): Promise<Document> {
  const error = errorFitxer(fitxer);
  if (error) throw new ApiFetchError('VALIDATION_ERROR', error);

  const { data: document } = await apiFetch<DocumentCreat>('/api/documents', {
    method: 'POST',
    body: JSON.stringify({
      entitat,
      entitatId,
      nom: fitxer.name,
      mime: tipusDocument(fitxer.name, fitxer.type),
      mida: fitxer.size,
    }),
  });

  try {
    for (let idx = 0; idx < document.parts; idx++) {
      const tros = fitxer.slice(idx * document.midaPart, (idx + 1) * document.midaPart);
      await apiFetch(`/api/documents/${document.id}/parts/${idx}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: tros,
      });
    }
    const { data } = await apiFetch<Document>(`/api/documents/${document.id}/completar`, { method: 'POST' });
    return data;
  } catch (err) {
    // No es deixa una pujada a mitges: el servidor també les neteja al cap d'un dia.
    await apiFetch(`/api/documents/${document.id}`, { method: 'DELETE' }).catch(() => undefined);
    throw err;
  }
}

export function usePujarDocument(entitat: EntitatDocument, entitatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fitxer: File) => pujarDocument(entitat, entitatId, fitxer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKeys.list(entitat, entitatId) });
    },
  });
}

export function useEsborrarDocument(entitat: EntitatDocument, entitatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/documents/${id}`, { method: 'DELETE' }).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsKeys.list(entitat, entitatId) });
    },
  });
}

/** Baixa tots els trossos, els ajunta i desa el fitxer amb el seu nom original. */
export async function descarregarDocument(document: Document): Promise<void> {
  const trossos: ArrayBuffer[] = [];
  for (let idx = 0; idx < document.parts; idx++) {
    trossos.push(await apiFetchBinary(`/api/documents/${document.id}/parts/${idx}`));
  }
  const url = URL.createObjectURL(new Blob(trossos, { type: document.mime }));
  try {
    const enllac = window.document.createElement('a');
    enllac.href = url;
    enllac.download = document.nom;
    enllac.click();
  } finally {
    // Es dona temps al navegador per començar la descàrrega abans d'alliberar-lo.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
