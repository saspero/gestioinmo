'use client';

import * as React from 'react';

import {
  useCrearGarantia,
  useEsborrarGarantia,
  useGarantiesContracte,
  type Garantia,
  type TipusGarantia,
} from '@/hooks/use-contractes';
import { ApiFetchError } from '@/hooks/api-client';
import { ConfirmDialog, DataTable, EmptyState, FormField, LoadingSkeleton } from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { TIPUS_GARANTIA_OPTIONS } from '@/features/contractes/types';

const missatgeError = (err: unknown) =>
  err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat. Torna-ho a provar més tard.";

const nomGarantia = (tipus: string) => TIPUS_GARANTIA_OPTIONS.find((o) => o.value === tipus)?.label ?? tipus;

/** Garanties addicionals a la fiança: aval bancari, dipòsit, assegurança d'impagament... */
export function GarantiesSection({ contracteId, canWrite }: { contracteId: string; canWrite: boolean }) {
  const { data: garanties, isLoading } = useGarantiesContracte(contracteId);
  const esborrar = useEsborrarGarantia(contracteId);
  const [afegint, setAfegint] = React.useState(false);
  const [perEsborrar, setPerEsborrar] = React.useState<Garantia | undefined>(undefined);

  async function handleEsborrar() {
    if (!perEsborrar) return;
    try {
      await esborrar.mutateAsync(perEsborrar.id);
      toast({ title: 'Garantia esborrada' });
      setPerEsborrar(undefined);
    } catch (err) {
      toast({ variant: 'destructive', title: "No s'ha pogut esborrar", description: missatgeError(err) });
    }
  }

  const columns: ColumnDef<Garantia>[] = [
    { id: 'tipus', header: 'Garantia', cell: (row) => nomGarantia(row.tipus) },
    { id: 'import', header: 'Import', cell: (row) => (row.import ? `${row.import} €` : '—') },
    { id: 'entitat', header: 'Entitat', cell: (row) => row.entitat ?? '—' },
    { id: 'venciment', header: 'Venciment', cell: (row) => row.dataVenciment ?? '—' },
    { id: 'notes', header: 'Notes', cell: (row) => row.notes ?? '—' },
    {
      id: 'accions',
      header: '',
      cell: (row) =>
        canWrite ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setPerEsborrar(row)}>
              Esborrar
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Garanties</h2>
        {canWrite && (
          <Button variant="outline" size="sm" onClick={() => setAfegint(true)}>
            Afegir garantia
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="table" columns={4} rows={1} />
      ) : !garanties || garanties.length === 0 ? (
        <EmptyState title="Sense garanties addicionals a la fiança." />
      ) : (
        <DataTable columns={columns} data={garanties} getRowId={(row) => row.id} />
      )}

      {canWrite && (
        <>
          <AfegirGarantiaDialog contracteId={contracteId} open={afegint} onOpenChange={setAfegint} />
          <ConfirmDialog
            open={perEsborrar !== undefined}
            onOpenChange={(open) => !open && setPerEsborrar(undefined)}
            title="Esborrar la garantia"
            description={`S'esborrarà la garantia "${perEsborrar ? nomGarantia(perEsborrar.tipus) : ''}" d'aquest contracte.`}
            destructive
            loading={esborrar.isPending}
            onConfirm={handleEsborrar}
          />
        </>
      )}
    </section>
  );
}

function AfegirGarantiaDialog({
  contracteId,
  open,
  onOpenChange,
}: {
  contracteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const crear = useCrearGarantia(contracteId);
  const [tipus, setTipus] = React.useState<TipusGarantia>('aval_bancari');
  const [importValor, setImportValor] = React.useState('');
  const [entitat, setEntitat] = React.useState('');
  const [dataVenciment, setDataVenciment] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setErrors({});
    try {
      await crear.mutateAsync({
        tipus,
        import: importValor ? Number(importValor) : undefined,
        entitat: entitat || undefined,
        dataVenciment: dataVenciment || undefined,
        notes: notes || undefined,
      });
      toast({ title: 'Garantia afegida' });
      setImportValor('');
      setEntitat('');
      setDataVenciment('');
      setNotes('');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiFetchError) setErrors(err.fields ?? {});
      setError(missatgeError(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Afegir garantia</DialogTitle>
            <DialogDescription>El document de l&apos;aval o de la pòlissa es pot adjuntar a Documents.</DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Tipus" required error={errors.tipus}>
              <Select value={tipus} onChange={(event) => setTipus(event.target.value as TipusGarantia)}>
                {TIPUS_GARANTIA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Import (€)" description="Opcional" error={errors.import}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={importValor}
                onChange={(event) => setImportValor(event.target.value)}
              />
            </FormField>
            <FormField label="Entitat" description="Banc o asseguradora" error={errors.entitat}>
              <Input value={entitat} onChange={(event) => setEntitat(event.target.value)} />
            </FormField>
            <FormField label="Venciment" description="Opcional" error={errors.dataVenciment}>
              <Input type="date" value={dataVenciment} onChange={(event) => setDataVenciment(event.target.value)} />
            </FormField>
          </div>
          <FormField label="Notes" error={errors.notes}>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" loading={crear.isPending}>
              Afegir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
