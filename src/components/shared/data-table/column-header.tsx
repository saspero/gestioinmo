'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { cn } from '@/components/lib/utils';
import type { SortDirection } from '@/components/shared/data-table/types';

export interface DataTableColumnHeaderProps {
  label: React.ReactNode;
  sortable?: boolean;
  sortDirection?: SortDirection;
  onSort?: () => void;
  className?: string;
}

/**
 * Capçalera de columna: si és ordenable, és l'única part client de la fila
 * (`docs/architecture.md` §4 — "regla de fulla", mai la pàgina sencera).
 */
function DataTableColumnHeader({
  label,
  sortable = false,
  sortDirection,
  onSort,
  className,
}: DataTableColumnHeaderProps) {
  if (!sortable) {
    return <span className={className}>{label}</span>;
  }

  const Icon = sortDirection === 'asc' ? ArrowUp : sortDirection === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={onSort}
      aria-label={`Ordenar per ${typeof label === 'string' ? label : 'aquesta columna'}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm text-left font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {label}
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

export { DataTableColumnHeader };
