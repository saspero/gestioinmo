import * as React from 'react';

import { cn } from '@/components/lib/utils';
import { NavMenu, type NavItem } from '@/components/shared/nav-menu';
import { UserMenu } from '@/components/shared/user-menu';

export interface AppShellProps {
  /** Nom de l'agència (tenant), sempre visible, sense selector (`docs/ux-flows.md` §5). */
  tenantName: string;
  navItems: NavItem[];
  activeHref?: string;
  user: {
    name: string;
    roleLabel: string;
  };
  onLogout: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Esquelet de pàgina del `(dashboard)`: barra lateral de navegació +
 * capçalera de context + àrea de contingut. Purament de presentació — la
 * resolució de sessió/tenant/rol és responsabilitat de l'Auth Specialist al
 * `layout.tsx` real (`docs/architecture.md` §2/§3), fora de l'scope d'aquest
 * agent.
 */
function AppShell({ tenantName, navItems, activeHref, user, onLogout, children, className }: AppShellProps) {
  return (
    <div className={cn('flex min-h-screen flex-col sm:flex-row', className)}>
      <aside className="flex shrink-0 flex-col gap-4 border-b border-border p-4 sm:w-64 sm:border-b-0 sm:border-r">
        <span className="px-1 text-sm font-semibold text-foreground">{tenantName}</span>
        <NavMenu items={navItems} activeHref={activeHref} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-border p-4">
          <UserMenu name={user.name} roleLabel={user.roleLabel} onLogout={onLogout} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export { AppShell };
