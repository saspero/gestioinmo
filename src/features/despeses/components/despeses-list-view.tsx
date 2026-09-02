'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useListDespeses, type Despesa, type DespesesFilters } from '@/hooks/use-despeses';
import { useListPropietats } from '@/hooks/use-propietats';
import { DataTable, ErrorState } from '@/components/shared';
import type { ColumnDef, SortState } from '@/components/shared/data-table/types';
import { Select } from '@/components/ui/select';
import { CATEGORIA_DESPESA_OPTIONS } from '@/features/despeses/types';

const PAGE_SIZE = 20;

export function DespesesListView() {
  const router = useRouter();
  const [propietatId, setPropietatId] = React.useState('');
  const [categoria, setCategoria] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<SortState | undefined>(undefined);

  const { data: propietats } = useListPropietats({ pageSize: 100 });

  const filters: DespesesFilters = {
    page,
    pageSize: PAGE_SIZE,
    propietatId: propietatId || undefined,
    categoria: (categoria || undefined) as DespesesFilters['categoria'],
    sort: sort?.columnId,
    order: sort?.direction,
  };

  const { data, isLoading, isError, refetch } = useListDespeses(filters);

  const columns: ColumnDef<Despesa>[] = [
    { id: 'dataDespesa', header: 'Data', cell: (row) => row.dataDespesa, sortable: true },
    { id: 'concepte', header: 'Concepte', cell: (row) => row.concepte },
    {
      id: 'categoria',
      header: 'Categoria',
      cell: (row) => CATEGORIA_DESPESA_OPTIONS.find((o) => o.value === row.categoria)?.label ?? row.categoria,
    },
    { id: 'import', header: 'Import', cell: (row) => `${row.import} €`, className: 'text-right' },
    { id: 'repercutiblePropietari', header: 'Repercutible', cell: (row) => (row.repercutiblePropietari ? 'Sí' : 'No') },
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
      onRowClick={(row) => router.push(`/despeses/${row.id}`)}
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
      emptyTitle="Encara no hi ha cap despesa registrada."
      emptyDescription="Crea la primera per començar a fer seguiment de les despeses de la cartera."
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={propietatId}
            onChange={(event) => {
              setPropietatId(event.target.value);
              setPage(1);
            }}
            aria-label="Filtra per propietat"
            className="sm:max-w-[14rem]"
          >
            <option value="">Totes les propietats</option>
            {(propietats?.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.referencia}
              </option>
            ))}
          </Select>
          <Select
            value={categoria}
            onChange={(event) => {
              setCategoria(event.target.value);
              setPage(1);
            }}
            aria-label="Filtra per categoria"
            className="sm:max-w-[10rem]"
          >
            <option value="">Totes les categories</option>
            {CATEGORIA_DESPESA_OPTIONS.map((option) => (
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
