// Configuració global de QueryClient (docs/agents/AGENT_STATE.md §5). `staleTime` per
// defecte moderat perquè els llistats no facin fetch continu, coherent amb el requisit
// de rendiment `docs/requirements.md` §4 (llistats < 500ms: servits de caché mentre no
// caduquin). Cada `useList[Modul]` pot sobreescriure `staleTime` segons la volatilitat
// pròpia del mòdul (ex: propietats canvien poc, pagaments/incidències sovint).

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
