'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useListPropietaris, type Propietari, type PropietarisFilters } from '@/hooks/use-propietaris';
import { DataTable, ErrorState } from '@/components/shared';
import type { ColumnDef, SortState } from '@/components/shared/data-table/types';
import { Input } from '@/components/ui/input';

const PAGE_SIZE = 20;

const COLUMNS: ColumnDef<Propietari>[] = [
  { id: 'nom', header: 'Nom', cell: (row) => `${row.nom} ${row.cognoms ?? ''}`.trim(), sortable: true },
  { id: 'nif', header: 'NIF/CIF', cell: (row) => row.nif ?? '—' },
  { id: 'telefon', header: 'Telèfon', cell: (row) => row.telefon ?? '—' },
  { id: 'email', header: 'Email', cell: (row) => row.email ?? '—' },
];

export function PropietarisListView() {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<SortState | undefined>(undefined);

  const filters: PropietarisFilters = {
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    sort: sort?.columnId,
    order: sort?.direction,
  };

  const { data, isLoading, isError, refetch } = useListPropietaris(filters);

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <DataTable
      columns={COLUMNS}
      data={data?.data ?? []}
      getRowId={(row) => row.id}
      loading={isLoading}
      onRowClick={(row) => router.push(`/propietaris/${row.id}`)}
      sort={sort}
      onSortChange={(next) => {
        setSort(next);
        setPage(1);
      }}
      pagination={{ page, pageSize: PAGE_SIZE, total: data?.meta?.total ?? 0, onPageChange: setPage }}
      emptyTitle="Encara no hi ha cap propietari."
      emptyDescription="Crea el primer per poder-li associar propietats."
      toolbar={
        <Input
          placeholder="Cerca per nom…"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
          aria-label="Cerca propietaris"
          className="sm:max-w-xs"
        />
      }
    />
  );
}
