import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/components/lib/utils';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

export interface NavMenuProps {
  items: NavItem[];
  /**
   * Ruta activa, resolta pel consumidor (ex: `usePathname()` al
   * `(dashboard)/layout.tsx`). Aquest component és de presentació pura, no
   * coneix el router.
   */
  activeHref?: string;
  className?: string;
}

/**
 * Menú principal (`docs/ux-flows.md` §5): cada entrada es mostra sempre que
 * l'agent (Feature Developer) l'hi passi ja filtrada segons la matriu de
 * permisos de `docs/requirements.md` §2.2 — aquest component no coneix rols.
 */
function NavMenu({ items, activeHref, className }: NavMenuProps) {
  return (
    <nav aria-label="Menú principal" className={cn('flex flex-col gap-0.5', className)}>
      {items.map((item) => {
        const isActive = activeHref === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export { NavMenu };
