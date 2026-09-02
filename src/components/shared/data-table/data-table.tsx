'use client';

import * as React from 'react';

import { cn } from '@/components/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { DataTableColumnHeader } from '@/components/shared/data-table/column-header';
import { DataTablePagination } from '@/components/shared/data-table/data-table-pagination';
import type { ColumnDef, SortState } from '@/components/shared/data-table/types';

export interface DataTablePaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  getRowId: (row: T) => string | number;
  /** Slot per a cerca/filtres (patró "Llistat paginat"): la taula no en sap res, només el renderitza. */
  toolbar?: React.ReactNode;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  pagination?: DataTablePaginationConfig;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
}

/**
 * Taula genèrica del patró "Llistat paginat" (`docs/ux-flows.md` §1): rep
 * dades i callbacks per props, sense fer `fetch` ni conèixer React Query
 * (`docs/agents/AGENT_UI_COMPONENTS.md` §3/§4).
 */
function DataTable<T>({
  columns,
  data,
  getRowId,
  toolbar,
  sort,
  onSortChange,
  pagination,
  onRowClick,
  loading = false,
  emptyTitle = 'Encara no hi ha cap element.',
  emptyDescription,
  emptyAction,
  className,
}: DataTableProps<T>) {
  const handleSort = (columnId: string) => {
    if (!onSortChange) return;
    if (sort?.columnId !== columnId) {
      onSortChange({ columnId, direction: 'asc' });
      return;
    }
    onSortChange({ columnId, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {toolbar}

      {loading ? (
        <LoadingSkeleton variant="table" columns={columns.length} />
      ) : data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id} className={column.headerClassName}>
                  <DataTableColumnHeader
                    label={column.header}
                    sortable={column.sortable}
                    sortDirection={sort?.columnId === column.id ? sort.direction : undefined}
                    onSort={() => handleSort(column.id)}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((column) => (
                  <TableCell key={column.id} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && data.length > 0 && pagination && (
        <DataTablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
        />
      )}
    </div>
  );
}

export { DataTable };
