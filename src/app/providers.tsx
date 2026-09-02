'use client';

// Munta un únic QueryClient (docs/agents/AGENT_STATE.md, `src/hooks/query-client.ts`) i el
// Toaster a l'arrel de l'aplicació — cap altre lloc del codi ho fa (docs/components/ui/toaster.tsx).
// Necessari perquè qualsevol hook de `src/hooks/use-*.ts` (usat pels mòduls del dashboard)
// tingui un `QueryClient` disponible via context.

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/hooks/query-client';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
