'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { usePagament, useDeletePagament } from '@/hooks/use-pagaments';
import { ApiFetchError } from '@/hooks/api-client';
import { LoadingSkeleton, ErrorState, StatusBadge, ConfirmDialog } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { METODE_PAGAMENT_OPTIONS } from '@/features/pagaments/types';
import { CobrarDialog } from '@/features/pagaments/components/cobrar-dialog';

interface PagamentDetailViewProps {
  id: string;
  canWrite: boolean;
}

export function PagamentDetailView({ id, canWrite }: PagamentDetailViewProps) {
  const router = useRouter();
  const { data: pagament, isLoading, isError, refetch } = usePagament(id);
  const deletePagament = useDeletePagament();
  const [cobrarOpen, setCobrarOpen] = React.useState(false);
  const [anularOpen, setAnularOpen] = React.useState(false);

  if (isLoading) {
    return <LoadingSkeleton variant="detail" sections={1} />;
  }

  if (isError || !pagament) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  async function handleAnular() {
    try {
      await deletePagament.mutateAsync(id);
      toast({ title: 'Rebut anul·lat' });
      setAnularOpen(false);
    } catch (error) {
      setAnularOpen(false);
      const message =
        error instanceof ApiFetchError ? error.message : "S'ha produït un error inesperat. Torna-ho a provar més tard.";
      toast({ variant: 'destructive', title: 'No s\'ha pogut anul·lar el rebut', description: message });
    }
  }

  const potCobrar = pagament.estat === 'pendent' || pagament.estat === 'vencut' || pagament.estat === 'mora';
  const potAnular = pagament.estat === 'cobrat';

  return (
    <div className="flex flex-col gap-6">
      {pagament.estat === 'mora' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Aquest rebut porta més de 30 dies vençut i ha activat l&apos;estat de mora de l&apos;inquilí.
        </div>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Concepte" value={pagament.concepte} />
          <Field label="Import" value={`${pagament.import} €`} />
          <Field label="Estat" value={<StatusBadge type="pagament" value={pagament.estat} />} />
          <Field label="Venciment" value={pagament.dataVenciment} />
          <Field label="Data de cobrament" value={pagament.dataCobrament ?? '—'} />
          <Field
            label="Mètode"
            value={METODE_PAGAMENT_OPTIONS.find((o) => o.value === pagament.metode)?.label ?? pagament.metode ?? '—'}
          />
          <Field
            label="Contracte"
            value={
              <Link href={`/contractes/${pagament.contracteId}`} className="text-primary hover:underline">
                Veure contracte
              </Link>
            }
          />
        </CardContent>
      </Card>

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {potCobrar && <Button onClick={() => setCobrarOpen(true)}>Marcar com a cobrat</Button>}
          {potAnular && (
            <Button variant="destructive" onClick={() => setAnularOpen(true)}>
              Anul·lar
            </Button>
          )}
        </div>
      )}

      <CobrarDialog pagament={pagament} open={cobrarOpen} onOpenChange={setCobrarOpen} />
      <ConfirmDialog
        open={anularOpen}
        onOpenChange={setAnularOpen}
        title="Anul·lar rebut"
        description="Es marcarà aquest rebut com a anul·lat i quedarà registrat a l'auditoria. Aquesta acció no es pot desfer."
        destructive
        loading={deletePagament.isPending}
        onConfirm={handleAnular}
      />
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
