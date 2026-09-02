'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useListIncidencies, type Incidencia, type IncidenciesFilters } from '@/hooks/use-incidencies';
import { DataTable, ErrorState, StatusBadge } from '@/components/shared';
import type { ColumnDef, SortState } from '@/components/shared/data-table/types';
import { Select } from '@/components/ui/select';
import { ESTAT_INCIDENCIA_OPTIONS, PRIORITAT_OPTIONS } from '@/features/incidencies/types';

const PAGE_SIZE = 20;

interface IncidenciesListViewProps {
  estatInicial?: string;
}

export function IncidenciesListView({ estatInicial }: IncidenciesListViewProps) {
  const router = useRouter();
  const [estat, setEstat] = React.useState(estatInicial ?? '');
  const [prioritat, setPrioritat] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<SortState | undefined>(undefined);

  const filters: IncidenciesFilters = {
    page,
    pageSize: PAGE_SIZE,
    estat: (estat || undefined) as IncidenciesFilters['estat'],
    prioritat: (prioritat || undefined) as IncidenciesFilters['prioritat'],
    sort: sort?.columnId,
    order: sort?.direction,
  };

  const { data, isLoading, isError, refetch } = useListIncidencies(filters);

  const columns: ColumnDef<Incidencia>[] = [
    { id: 'titol', header: 'Títol', cell: (row) => row.titol, sortable: true },
    { id: 'prioritat', header: 'Prioritat', cell: (row) => <StatusBadge type="prioritat" value={row.prioritat} /> },
    { id: 'estat', header: 'Estat', cell: (row) => <StatusBadge type="incidencia" value={row.estat} /> },
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
      onRowClick={(row) => router.push(`/incidencies/${row.id}`)}
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
      emptyTitle="Encara no hi ha cap incidència."
      emptyDescription="Crea la primera per començar a fer seguiment d'avaries i reparacions."
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row">
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
            {ESTAT_INCIDENCIA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            value={prioritat}
            onChange={(event) => {
              setPrioritat(event.target.value);
              setPage(1);
            }}
            aria-label="Filtra per prioritat"
            className="sm:max-w-[10rem]"
          >
            <option value="">Totes les prioritats</option>
            {PRIORITAT_OPTIONS.map((option) => (
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
