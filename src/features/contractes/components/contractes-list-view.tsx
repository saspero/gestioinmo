'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useListContractes, type Contracte, type ContractesFilters } from '@/hooks/use-contractes';
import { DataTable, ErrorState, StatusBadge } from '@/components/shared';
import type { ColumnDef, SortState } from '@/components/shared/data-table/types';
import { Select } from '@/components/ui/select';
import { TIPUS_US_OPTIONS, ESTAT_CONTRACTE_OPTIONS } from '@/features/contractes/types';

const PAGE_SIZE = 20;

export function ContractesListView() {
  const router = useRouter();
  const [estat, setEstat] = React.useState('');
  const [tipusUs, setTipusUs] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<SortState | undefined>(undefined);

  const filters: ContractesFilters = {
    page,
    pageSize: PAGE_SIZE,
    estat: (estat || undefined) as ContractesFilters['estat'],
    tipusUs: tipusUs || undefined,
    sort: sort?.columnId,
    order: sort?.direction,
  };

  const { data, isLoading, isError, refetch } = useListContractes(filters);

  const columns: ColumnDef<Contracte>[] = [
    { id: 'dataInici', header: 'Data inici', cell: (row) => row.dataInici, sortable: true },
    {
      id: 'tipusUs',
      header: 'Ús',
      cell: (row) => TIPUS_US_OPTIONS.find((o) => o.value === row.tipusUs)?.label ?? row.tipusUs,
    },
    { id: 'renda', header: 'Renda', cell: (row) => `${row.renda} €`, className: 'text-right' },
    {
      id: 'estat',
      header: 'Estat',
      cell: (row) => (
        <StatusBadge type="contracte" value={row.estat as 'esborrany' | 'actiu' | 'finalitzat' | 'resolt'} />
      ),
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
      onRowClick={(row) => router.push(`/contractes/${row.id}`)}
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
      emptyTitle="Encara no hi ha cap contracte."
      emptyDescription="Crea'n un des d'una unitat vacant o des d'aquí."
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
            {ESTAT_CONTRACTE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            value={tipusUs}
            onChange={(event) => {
              setTipusUs(event.target.value);
              setPage(1);
            }}
            aria-label="Filtra per tipus d'ús"
            className="sm:max-w-[10rem]"
          >
            <option value="">Tots els usos</option>
            {TIPUS_US_OPTIONS.map((option) => (
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
