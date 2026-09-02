'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useDespesa, useDeleteDespesa } from '@/hooks/use-despeses';
import { ApiFetchError } from '@/hooks/api-client';
import { LoadingSkeleton, ErrorState, ConfirmDialog } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { CATEGORIA_DESPESA_OPTIONS } from '@/features/despeses/types';

interface DespesaDetailViewProps {
  id: string;
  canWrite: boolean;
}

export function DespesaDetailView({ id, canWrite }: DespesaDetailViewProps) {
  const router = useRouter();
  const { data: despesa, isLoading, isError, refetch } = useDespesa(id);
  const deleteDespesa = useDeleteDespesa();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  if (isLoading) {
    return <LoadingSkeleton variant="detail" sections={1} />;
  }

  if (isError || !despesa) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  async function handleDelete() {
    try {
      await deleteDespesa.mutateAsync(id);
      toast({ title: 'Despesa eliminada' });
      router.push('/despeses');
    } catch (error) {
      setConfirmOpen(false);
      const message =
        error instanceof ApiFetchError ? error.message : "S'ha produït un error inesperat. Torna-ho a provar més tard.";
      toast({ variant: 'destructive', title: "No s'ha pogut eliminar la despesa", description: message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Concepte" value={despesa.concepte} />
          <Field label="Import" value={`${despesa.import} €`} />
          <Field
            label="Categoria"
            value={CATEGORIA_DESPESA_OPTIONS.find((o) => o.value === despesa.categoria)?.label ?? despesa.categoria}
          />
          <Field label="Data" value={despesa.dataDespesa} />
          <Field label="Proveïdor" value={despesa.proveidor ?? '—'} />
          <Field label="Repercutible al propietari" value={despesa.repercutiblePropietari ? 'Sí' : 'No'} />
          <Field
            label="Propietat"
            value={
              <Link href={`/propietats/${despesa.propietatId}`} className="text-primary hover:underline">
                Veure propietat
              </Link>
            }
          />
          {despesa.incidenciaId && (
            <Field
              label="Incidència relacionada"
              value={
                <Link href={`/incidencies/${despesa.incidenciaId}`} className="text-primary hover:underline">
                  Veure incidència
                </Link>
              }
            />
          )}
          {despesa.facturaUrl && (
            <Field
              label="Factura"
              value={
                <a href={despesa.facturaUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Obrir factura
                </a>
              }
            />
          )}
          {despesa.notes && <Field label="Notes" value={despesa.notes} className="sm:col-span-2 lg:col-span-3" />}
        </CardContent>
      </Card>

      {canWrite && (
        <div>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Eliminar despesa
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Eliminar despesa"
            description={`S'eliminarà la despesa "${despesa.concepte}" (${despesa.import} €). Aquesta acció no es pot desfer.`}
            destructive
            loading={deleteDespesa.isPending}
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
