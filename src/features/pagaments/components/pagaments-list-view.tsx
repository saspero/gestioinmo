'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useListPagaments, type Pagament, type PagamentsFilters } from '@/hooks/use-pagaments';
import { DataTable, ErrorState, StatusBadge } from '@/components/shared';
import type { ColumnDef, SortState } from '@/components/shared/data-table/types';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ESTAT_PAGAMENT_OPTIONS } from '@/features/pagaments/types';
import { CobrarDialog } from '@/features/pagaments/components/cobrar-dialog';

const PAGE_SIZE = 20;

interface PagamentsListViewProps {
  estatInicial?: string;
}

export function PagamentsListView({ estatInicial }: PagamentsListViewProps) {
  const router = useRouter();
  const [estat, setEstat] = React.useState(estatInicial ?? '');
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<SortState | undefined>(undefined);
  const [cobrarPagament, setCobrarPagament] = React.useState<Pagament | null>(null);

  const filters: PagamentsFilters = {
    page,
    pageSize: PAGE_SIZE,
    estat: (estat || undefined) as PagamentsFilters['estat'],
    sort: sort?.columnId,
    order: sort?.direction,
  };

  const { data, isLoading, isError, refetch } = useListPagaments(filters);

  const columns: ColumnDef<Pagament>[] = [
    { id: 'concepte', header: 'Concepte', cell: (row) => row.concepte },
    { id: 'dataVenciment', header: 'Venciment', cell: (row) => row.dataVenciment, sortable: true },
    { id: 'import', header: 'Import', cell: (row) => `${row.import} €`, className: 'text-right' },
    { id: 'estat', header: 'Estat', cell: (row) => <StatusBadge type="pagament" value={row.estat} /> },
    {
      id: 'accions',
      header: '',
      cell: (row) =>
        row.estat === 'pendent' || row.estat === 'vencut' || row.estat === 'mora' ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              setCobrarPagament(row);
            }}
          >
            Marcar com a cobrat
          </Button>
        ) : null,
    },
  ];

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        getRowId={(row) => row.id}
        loading={isLoading}
        onRowClick={(row) => router.push(`/pagaments/${row.id}`)}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: data?.meta?.total ?? 0,
          onPageChange: setPage,
        }}
        emptyTitle="Encara no hi ha cap rebut."
        emptyDescription="Els rebuts es generen automàticament a partir dels contractes actius."
        toolbar={
          <Select
            value={estat}
            onChange={(event) => {
              setEstat(event.target.value);
              setPage(1);
            }}
            aria-label="Filtra per estat"
            className="sm:max-w-[10rem]"
          >
            <option value="">Tots els estats</option>
            {ESTAT_PAGAMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        }
      />

      {cobrarPagament && (
        <CobrarDialog
          pagament={cobrarPagament}
          open={Boolean(cobrarPagament)}
          onOpenChange={(open) => !open && setCobrarPagament(null)}
        />
      )}
    </>
  );
}
