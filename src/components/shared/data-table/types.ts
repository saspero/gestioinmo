import * as React from 'react';

export interface ColumnDef<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** Classes de la cel·la de dades (ex: alinear imports a la dreta). */
  className?: string;
  headerClassName?: string;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  columnId: string;
  direction: SortDirection;
}
