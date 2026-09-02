'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';

import { useInquili, useDeleteInquili } from '@/hooks/use-inquilins';
import { useListContractes } from '@/hooks/use-contractes';
import { ApiFetchError } from '@/hooks/api-client';
import { LoadingSkeleton, ErrorState, StatusBadge, ConfirmDialog, EmptyState } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { DataTable } from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';
import type { Contracte } from '@/hooks/use-contractes';

interface InquiliDetailViewProps {
  id: string;
  canWrite: boolean;
}

export function InquiliDetailView({ id, canWrite }: InquiliDetailViewProps) {
  const router = useRouter();
  const { data: inquili, isLoading, isError, refetch } = useInquili(id);
  // Sense filtre `inquiliId` a l'API de contractes (docs/architecture.md §3): es llista
  // una pàgina prou gran i es filtra pel `inquilinsIds` de cada contracte al client.
  const { data: contractesData, isLoading: contractesLoading } = useListContractes({ pageSize: 100 });
  const deleteInquili = useDeleteInquili();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  if (isLoading) {
    return <LoadingSkeleton variant="detail" sections={2} />;
  }

  if (isError || !inquili) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const contractesInquili = (contractesData?.data ?? []).filter((c) => c.inquilinsIds.includes(id));

  const columns: ColumnDef<Contracte>[] = [
    { id: 'dataInici', header: 'Data inici', cell: (row) => row.dataInici },
    { id: 'renda', header: 'Renda', cell: (row) => `${row.renda} €` },
    {
      id: 'estat',
      header: 'Estat',
      cell: (row) => (
        <StatusBadge type="contracte" value={row.estat as 'esborrany' | 'actiu' | 'finalitzat' | 'resolt'} />
      ),
    },
  ];

  async function handleDelete() {
    try {
      await deleteInquili.mutateAsync(id);
      toast({ title: 'Inquilí donat de baixa' });
      router.push('/inquilins');
    } catch (error) {
      setConfirmOpen(false);
      const message =
        error instanceof ApiFetchError
          ? error.message
          : "S'ha produït un error inesperat. Torna-ho a provar més tard.";
      toast({ variant: 'destructive', title: 'No s\'ha pogut donar de baixa', description: message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {inquili.estatInquili === 'moros' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          <span>Aquest inquilí està en mora.</span>
          <Link href={`/pagaments?estat=vencut`} className="font-medium underline">
            Veure rebuts pendents
          </Link>
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nom" value={`${inquili.nom} ${inquili.cognoms ?? ''}`.trim()} />
          <Field label="NIF/NIE" value={inquili.nif ?? '—'} />
          <Field
            label="Estat"
            value={inquili.estatInquili ? <StatusBadge type="inquili" value={inquili.estatInquili} /> : '—'}
          />
          <Field label="Email" value={inquili.email ?? '—'} />
          <Field label="Telèfon" value={inquili.telefon ?? '—'} />
          <Field label="IBAN" value={inquili.iban ?? '—'} />
          <Field label="Adreça" value={inquili.adreca ?? '—'} />
          {inquili.notes && <Field label="Notes" value={inquili.notes} className="sm:col-span-2 lg:col-span-3" />}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Contractes</h2>
        {contractesLoading ? (
          <LoadingSkeleton variant="table" columns={3} rows={3} />
        ) : contractesInquili.length === 0 ? (
          <EmptyState title="Aquest inquilí encara no té cap contracte." />
        ) : (
          <DataTable
            columns={columns}
            data={contractesInquili}
            getRowId={(row) => row.id}
            onRowClick={(row) => router.push(`/contractes/${row.id}`)}
          />
        )}
      </div>

      {canWrite && (
        <div>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Donar de baixa
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Donar de baixa l'inquilí"
            description={`Es donarà de baixa a "${inquili.nom}". Si té un contracte actiu, l'operació es rebutjarà.`}
            destructive
            loading={deleteInquili.isPending}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
