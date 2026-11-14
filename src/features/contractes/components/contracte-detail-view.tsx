'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useContracte, useUpdateContracte, useResoldreContracte, type Contracte } from '@/hooks/use-contractes';
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
import { TIPUS_ACTUALITZACIO_OPTIONS, TIPUS_US_OPTIONS, textDurada } from '@/features/contractes/types';
import { properVenciment } from '@/lib/validations/contractes';
import { PactesFields, pactesInput, valorsPactes, type PactesValues } from './pactes-fields';
import { ConceptesSection } from './conceptes-section';
import { GarantiesSection } from './garanties-section';
import { AvisosContracte } from './avisos-contracte';
import { DocumentsSection } from '@/features/documents/components/documents-section';

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
  const [pactesOpen, setPactesOpen] = React.useState(false);

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
      <AvisosContracte contracte={contracte} canWrite={canWrite} />
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Estat"
            value={<StatusBadge type="contracte" value={contracte.estat as 'esborrany' | 'actiu' | 'finalitzat' | 'resolt'} />}
          />
          <Field label="Tipus d'ús" value={TIPUS_US_OPTIONS.find((o) => o.value === contracte.tipusUs)?.label ?? contracte.tipusUs} />
          <Field label="Data inici" value={contracte.dataInici} />
          <Field label="Data fi" value={contracte.dataFi ?? '—'} />
          <Field
            label="Renda vigent"
            value={
              contracte.renda === contracte.rendaInicial
                ? `${contracte.renda} €`
                : `${contracte.renda} € (inicial: ${contracte.rendaInicial} €)`
            }
          />
          <Field label="Fiança" value={`${contracte.fianca} €`} />
          <Field label="Actualització anual" value={textActualitzacio(contracte)} />
          <Field label="Durada inicial" value={contracte.duradaMesos ? textDurada(contracte.duradaMesos) : '—'} />
          <Field label="Pròrroga" value={textProrroga(contracte)} />
          <Field
            label="Venciment del període actual"
            value={properVenciment(contracte, new Date().toLocaleDateString('en-CA')) ?? '—'}
          />
          <Field label="Preavís per no renovar" value={contracte.preavisDies !== null ? `${contracte.preavisDies} dies` : '—'} />
          <Field label="Moblat" value={contracte.moblat ? 'Sí' : 'No'} />
          {contracte.estat === 'resolt' && (
            <>
              <Field label="Motiu de resolució" value={contracte.motiuResolucio ?? '—'} />
              <Field label="Data de resolució" value={contracte.dataResolucio ?? '—'} />
            </>
          )}
        </CardContent>
      </Card>

      <ConceptesSection contracteId={id} canWrite={canWrite} dataInici={contracte.dataInici} />
      <GarantiesSection contracteId={id} canWrite={canWrite} />
      <DocumentsSection entitat="contracte" entitatId={id} canWrite={canWrite} />

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPactesOpen(true)}>
            Editar pactes
          </Button>
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
      {pactesOpen && <EditarPactesDialog contracte={contracte} onClose={() => setPactesOpen(false)} />}
    </div>
  );
}

function textActualitzacio(contracte: Contracte): string {
  const label = TIPUS_ACTUALITZACIO_OPTIONS.find((o) => o.value === contracte.tipusActualitzacio)?.label ?? '—';
  return contracte.tipusActualitzacio === 'percentatge_fix' && contracte.percentatgePactat
    ? `${label}: ${contracte.percentatgePactat} %`
    : label;
}

function textProrroga(contracte: Contracte): string {
  if (!contracte.prorrogaAutomatica) return 'No automàtica';
  const cada = contracte.prorrogaMesos ? `cada ${textDurada(contracte.prorrogaMesos)}` : '';
  const fins = contracte.duradaMaximaMesos ? `, fins a ${textDurada(contracte.duradaMaximaMesos)} en total` : '';
  return `Automàtica ${cada}${fins}`.trim();
}

function EditarPactesDialog({ contracte, onClose }: { contracte: Contracte; onClose: () => void }) {
  const updateContracte = useUpdateContracte(contracte.id);
  const [values, setValues] = React.useState<PactesValues>(() => valorsPactes(contracte));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setErrors({});
    try {
      await updateContracte.mutateAsync(pactesInput(values, true));
      toast({ title: 'Pactes desats' });
      onClose();
    } catch (err) {
      if (err instanceof ApiFetchError) setErrors(err.fields ?? {});
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Editar pactes</DialogTitle>
            <DialogDescription>
              Durada, pròrrogues, actualització i mobles. Els imports es canvien a Renda i despeses, amb data
              d&apos;efecte.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <PactesFields values={values} onChange={setValues} errors={errors} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel·lar
            </Button>
            <Button type="submit" loading={updateContracte.isPending}>
              Desar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
