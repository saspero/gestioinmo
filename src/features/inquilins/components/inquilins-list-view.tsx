'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useListInquilins, type Inquili, type InquilinsFilters } from '@/hooks/use-inquilins';
import { DataTable, ErrorState, StatusBadge } from '@/components/shared';
import type { ColumnDef, SortState } from '@/components/shared/data-table/types';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ESTAT_INQUILI_OPTIONS } from '@/features/inquilins/types';

const PAGE_SIZE = 20;

interface InquilinsListViewProps {
  estatInicial?: string;
}

export function InquilinsListView({ estatInicial }: InquilinsListViewProps) {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [estat, setEstat] = React.useState(estatInicial ?? '');
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<SortState | undefined>(undefined);

  const filters: InquilinsFilters = {
    page,
    pageSize: PAGE_SIZE,
    q: q || undefined,
    estatInquili: (estat || undefined) as InquilinsFilters['estatInquili'],
    sort: sort?.columnId,
    order: sort?.direction,
  };

  const { data, isLoading, isError, refetch } = useListInquilins(filters);

  const columns: ColumnDef<Inquili>[] = [
    { id: 'nom', header: 'Nom', cell: (row) => `${row.nom} ${row.cognoms ?? ''}`.trim(), sortable: true },
    { id: 'nif', header: 'NIF/NIE', cell: (row) => row.nif ?? '—' },
    { id: 'telefon', header: 'Telèfon', cell: (row) => row.telefon ?? '—' },
    { id: 'email', header: 'Email', cell: (row) => row.email ?? '—' },
    {
      id: 'estatInquili',
      header: 'Estat',
      cell: (row) => (row.estatInquili ? <StatusBadge type="inquili" value={row.estatInquili} /> : '—'),
    },
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
      onRowClick={(row) => router.push(`/inquilins/${row.id}`)}
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
      emptyTitle="Encara no hi ha cap inquilí."
      emptyDescription="Crea el primer per començar a gestionar contractes de lloguer."
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Cerca per nom o NIF…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            aria-label="Cerca inquilins"
            className="sm:max-w-xs"
          />
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
            {ESTAT_INQUILI_OPTIONS.map((option) => (
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
