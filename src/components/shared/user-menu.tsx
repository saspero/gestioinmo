'use client';

import * as React from 'react';
import { LogOut } from 'lucide-react';

import { cn } from '@/components/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface UserMenuProps {
  name: string;
  roleLabel: string;
  onLogout: () => void;
  className?: string;
}

/** Menú d'usuari (nom, rol, "Tancar sessió") accessible des de qualsevol pantalla del dashboard (`docs/ux-flows.md` §5). */
function UserMenu({ name, roleLabel, onLogout, className }: UserMenuProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 rounded-md p-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initial}
        </span>
        <span className="hidden flex-col items-start text-left sm:flex">
          <span className="font-medium text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">{roleLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block font-medium text-foreground">{name}</span>
          <span className="block text-xs text-muted-foreground">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>
          <LogOut aria-hidden />
          Tancar sessió
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { UserMenu };
