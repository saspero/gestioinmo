'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useListLiquidacions, type Liquidacio } from '@/hooks/use-liquidacions';
import { DataTable, ErrorState } from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';

const PAGE_SIZE = 20;

export function LiquidacionsListView() {
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, refetch } = useListLiquidacions({ page, pageSize: PAGE_SIZE });

  const columns: ColumnDef<Liquidacio>[] = [
    { id: 'propietari', header: 'Propietari', cell: (row) => row.propietariNom },
    { id: 'periode', header: 'Període', cell: (row) => `${row.periodeInici} — ${row.periodeFi}` },
    { id: 'cobrat', header: 'Cobrat', cell: (row) => `${row.totalCobrat} €`, className: 'text-right' },
    { id: 'net', header: 'Net a pagar', cell: (row) => `${row.netALiquidar} €`, className: 'text-right' },
    {
      id: 'estat',
      header: 'Estat',
      cell: (row) => (row.dataPagament ? `Pagada el ${row.dataPagament}` : 'Pendent de pagar'),
    },
  ];

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <DataTable
      columns={columns}
      data={data?.data ?? []}
      getRowId={(row) => row.id}
      loading={isLoading}
      onRowClick={(row) => router.push(`/pagaments/liquidacions/${row.id}`)}
      pagination={{ page, pageSize: PAGE_SIZE, total: data?.meta?.total ?? 0, onPageChange: setPage }}
      emptyTitle="Encara no hi ha cap liquidació."
      emptyDescription="Genera les liquidacions d'un període amb el botó «Generar liquidacions»."
    />
  );
}
