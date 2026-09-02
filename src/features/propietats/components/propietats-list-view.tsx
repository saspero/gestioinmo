'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useListPropietats, type Propietat, type PropietatsFilters } from '@/hooks/use-propietats';
import { DataTable, ErrorState } from '@/components/shared';
import type { ColumnDef, SortState } from '@/components/shared/data-table/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TIPUS_PROPIETAT_OPTIONS } from '@/features/propietats/types';

const PAGE_SIZE = 20;

export function PropietatsListView() {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [tipus, setTipus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<SortState | undefined>(undefined);

  const filters: PropietatsFilters = {
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    tipus: tipus || undefined,
    sort: sort?.columnId,
    order: sort?.direction,
  };

  const { data, isLoading, isError, refetch } = useListPropietats(filters);

  const columns: ColumnDef<Propietat>[] = [
    { id: 'referencia', header: 'Referència', cell: (row) => row.referencia, sortable: true },
    {
      id: 'tipus',
      header: 'Tipus',
      cell: (row) => TIPUS_PROPIETAT_OPTIONS.find((o) => o.value === row.tipus)?.label ?? row.tipus,
      sortable: true,
    },
    { id: 'adreca', header: 'Adreça', cell: (row) => row.adreca },
    { id: 'poblacio', header: 'Població', cell: (row) => row.poblacio ?? '—', sortable: true },
  ];

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <DataTable
      columns={columns}
      data={data?.data ?? []}
      getRowId={(row) => row.id}
      loading={isLoading}
      onRowClick={(row) => router.push(`/propietats/${row.id}`)}
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
      emptyTitle="Encara no hi ha cap propietat."
      emptyDescription="Crea la primera per començar a gestionar la teva cartera."
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Cerca per referència o adreça…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            aria-label="Cerca propietats"
            className="sm:max-w-xs"
          />
          <Select
            value={tipus}
            onChange={(event) => {
              setTipus(event.target.value);
              setPage(1);
            }}
            aria-label="Filtra per tipus"
            className="sm:max-w-[10rem]"
          >
            <option value="">Tots els tipus</option>
            {TIPUS_PROPIETAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      }
    />
  );
}
