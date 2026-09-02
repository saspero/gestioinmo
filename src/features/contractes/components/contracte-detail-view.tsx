'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useContracte, useUpdateContracte, useResoldreContracte } from '@/hooks/use-contractes';
import { useListPagaments, type Pagament } from '@/hooks/use-pagaments';
import { ApiFetchError } from '@/hooks/api-client';
import {
  LoadingSkeleton,
  ErrorState,
  StatusBadge,
  DataTable,
  EmptyState,
  FormField,
} from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { TIPUS_US_OPTIONS } from '@/features/contractes/types';

interface ContracteDetailViewProps {
  id: string;
  canWrite: boolean;
}

export function ContracteDetailView({ id, canWrite }: ContracteDetailViewProps) {
  const router = useRouter();
  const { data: contracte, isLoading, isError, refetch } = useContracte(id);
  const updateContracte = useUpdateContracte(id);
  const { data: pagamentsData, isLoading: pagamentsLoading } = useListPagaments({ contracteId: id, pageSize: 50 });

  const [renovarOpen, setRenovarOpen] = React.useState(false);
  const [resoldreOpen, setResoldreOpen] = React.useState(false);

  if (isLoading) {
    return <LoadingSkeleton variant="detail" sections={2} />;
  }

  if (isError || !contracte) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  async function handleActivar() {
    try {
      await updateContracte.mutateAsync({ estat: 'actiu' });
      toast({ title: 'Contracte activat' });
    } catch (error) {
      const message =
        error instanceof ApiFetchError ? error.message : "S'ha produït un error inesperat. Torna-ho a provar més tard.";
      toast({ variant: 'destructive', title: 'No s\'ha pogut activar el contracte', description: message });
    }
  }

  const pagamentsColumns: ColumnDef<Pagament>[] = [
    { id: 'concepte', header: 'Concepte', cell: (row) => row.concepte },
    { id: 'dataVenciment', header: 'Venciment', cell: (row) => row.dataVenciment },
    { id: 'import', header: 'Import', cell: (row) => `${row.import} €`, className: 'text-right' },
    { id: 'estat', header: 'Estat', cell: (row) => <StatusBadge type="pagament" value={row.estat} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Estat"
            value={<StatusBadge type="contracte" value={contracte.estat as 'esborrany' | 'actiu' | 'finalitzat' | 'resolt'} />}
          />
          <Field label="Tipus d'ús" value={TIPUS_US_OPTIONS.find((o) => o.value === contracte.tipusUs)?.label ?? contracte.tipusUs} />
          <Field label="Data inici" value={contracte.dataInici} />
          <Field label="Data fi" value={contracte.dataFi ?? '—'} />
          <Field label="Renda" value={`${contracte.renda} €`} />
          <Field label="Fiança" value={`${contracte.fianca} €`} />
          <Field label="Índex d'actualització" value={contracte.indexActualitzacio} />
          <Field label="Percentatge pactat" value={contracte.percentatgePactat ? `${contracte.percentatgePactat} %` : '—'} />
          {contracte.estat === 'resolt' && (
            <>
              <Field label="Motiu de resolució" value={contracte.motiuResolucio ?? '—'} />
              <Field label="Data de resolució" value={contracte.dataResolucio ?? '—'} />
            </>
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {contracte.estat === 'esborrany' && (
            <Button loading={updateContracte.isPending} onClick={handleActivar}>
              Activar
            </Button>
          )}
          {contracte.estat === 'actiu' && (
            <>
              <Button variant="outline" onClick={() => setRenovarOpen(true)}>
                Renovar
              </Button>
              <Button variant="destructive" onClick={() => setResoldreOpen(true)}>
                Resoldre
              </Button>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground">Rebuts</h2>
        {pagamentsLoading ? (
          <LoadingSkeleton variant="table" columns={4} rows={3} />
        ) : (pagamentsData?.data.length ?? 0) === 0 ? (
          <EmptyState title="Encara no s'ha generat cap rebut per a aquest contracte." />
        ) : (
          <DataTable
            columns={pagamentsColumns}
            data={pagamentsData?.data ?? []}
            getRowId={(row) => row.id}
            onRowClick={(row) => router.push(`/pagaments/${row.id}`)}
          />
        )}
      </div>

      <RenovarDialog contracteId={id} open={renovarOpen} onOpenChange={setRenovarOpen} dataFiActual={contracte.dataFi} />
      <ResoldreDialog contracteId={id} open={resoldreOpen} onOpenChange={setResoldreOpen} />
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

interface RenovarDialogProps {
  contracteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataFiActual: string | null;
}

function RenovarDialog({ contracteId, open, onOpenChange, dataFiActual }: RenovarDialogProps) {
  const updateContracte = useUpdateContracte(contracteId);
  const [dataFi, setDataFi] = React.useState(dataFiActual ?? '');
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      await updateContracte.mutateAsync({ dataFi });
      toast({ title: 'Contracte renovat' });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Renovar contracte</DialogTitle>
            <DialogDescription>Estableix la nova data de finalització de la pròrroga.</DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <FormField label="Nova data de finalització" required>
            <Input type="date" value={dataFi} onChange={(event) => setDataFi(event.target.value)} required />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" loading={updateContracte.isPending}>
              Renovar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ResoldreDialogProps {
  contracteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ResoldreDialog({ contracteId, open, onOpenChange }: ResoldreDialogProps) {
  const router = useRouter();
  const resoldreContracte = useResoldreContracte(contracteId);
  const [motiuResolucio, setMotiuResolucio] = React.useState('');
  const [dataResolucio, setDataResolucio] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      await resoldreContracte.mutateAsync({ motiuResolucio, dataResolucio });
      toast({ title: 'Contracte resolt' });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Resoldre contracte</DialogTitle>
            <DialogDescription>
              Aquesta acció allibera la unitat i és irreversible. Indica el motiu i la data efectiva.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <FormField label="Motiu" required>
            <Textarea value={motiuResolucio} onChange={(event) => setMotiuResolucio(event.target.value)} required />
          </FormField>
          <FormField label="Data efectiva" required>
            <Input type="date" value={dataResolucio} onChange={(event) => setDataResolucio(event.target.value)} required />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" variant="destructive" loading={resoldreContracte.isPending}>
              Resoldre
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
