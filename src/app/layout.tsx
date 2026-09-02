import type { Metadata } from 'next';

import { Providers } from './providers';
import './globals.css';

// Arrel compartida per `(auth)`, `(dashboard)` i `(portal)` (docs/architecture.md §3:
// "lang=\"ca\" fixat a app/layout.tsx arrel").
export const metadata: Metadata = {
  title: 'Gestinmo',
  description: 'Portal de gestió immobiliària multitenant.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
