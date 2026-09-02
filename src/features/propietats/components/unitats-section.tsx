'use client';

// No hi ha `useListUnitats`/`useCreateUnitat` a `src/hooks/` (només existeix el hook de
// la propietat mateixa, `use-propietats.ts`): es construeix aquí, amb `useQuery`/
// `useMutation` de React Query + `apiFetch` (`src/hooks/api-client.ts`), seguint
// exactament les mateixes convencions que la resta de hooks del projecte.

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { apiFetch, ApiFetchError } from '@/hooks/api-client';
import { DataTable, EmptyState, ErrorState, StatusBadge, FormField } from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import type { Unitat, CrearUnitatInput } from '@/features/propietats/types';

const unitatsKey = (propietatId: string) => ['propietats', propietatId, 'unitats'] as const;

interface UnitatsSectionProps {
  propietatId: string;
  canWrite: boolean;
}

export function UnitatsSection({ propietatId, canWrite }: UnitatsSectionProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: unitatsKey(propietatId),
    queryFn: () => apiFetch<Unitat[]>(`/api/propietats/${propietatId}/unitats`).then((res) => res.data),
  });

  const columns: ColumnDef<Unitat>[] = [
    { id: 'referencia', header: 'Referència', cell: (row) => row.referencia },
    { id: 'planta', header: 'Planta', cell: (row) => row.planta ?? '—' },
    { id: 'porta', header: 'Porta', cell: (row) => row.porta ?? '—' },
    { id: 'superficie', header: 'Superfície', cell: (row) => (row.superficie ? `${row.superficie} m²` : '—') },
    { id: 'rendaBase', header: 'Renda base', cell: (row) => (row.rendaBase ? `${row.rendaBase} €` : '—') },
    { id: 'estat', header: 'Estat', cell: (row) => <StatusBadge type="unitat" value={row.estat} /> },
    {
      id: 'contracte',
      header: '',
      cell: (row) =>
        row.estat === 'vacant' ? (
          <Link
            href={`/contractes/nou?unitatId=${row.id}&propietatId=${propietatId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Crear contracte
          </Link>
        ) : null,
    },
  ];

  if (isError) {
    return <ErrorState title="No s'han pogut carregar les unitats." onRetry={() => refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Unitats</h2>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus /> Afegir unitat
          </Button>
        )}
      </div>

      {isLoading ? (
        <DataTable columns={columns} data={[]} getRowId={(row) => row.id} loading />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          title="Aquesta propietat encara no té unitats."
          description="Afegeix-ne una."
          action={
            canWrite && (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus /> Afegir unitat
              </Button>
            )
          }
        />
      ) : (
        <DataTable columns={columns} data={data ?? []} getRowId={(row) => row.id} />
      )}

      {canWrite && (
        <AddUnitatDialog
          propietatId={propietatId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: unitatsKey(propietatId) });
            toast({ title: 'Unitat creada' });
          }}
        />
      )}
    </div>
  );
}

interface AddUnitatDialogProps {
  propietatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function AddUnitatDialog({ propietatId, open, onOpenChange, onCreated }: AddUnitatDialogProps) {
  const [referencia, setReferencia] = React.useState('');
  const [planta, setPlanta] = React.useState('');
  const [porta, setPorta] = React.useState('');
  const [superficie, setSuperficie] = React.useState('');
  const [rendaBase, setRendaBase] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const createUnitat = useMutation({
    mutationFn: (input: CrearUnitatInput) =>
      apiFetch<Unitat>(`/api/propietats/${propietatId}/unitats`, {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((res) => res.data),
  });

  function reset() {
    setReferencia('');
    setPlanta('');
    setPorta('');
    setSuperficie('');
    setRendaBase('');
    setFieldErrors({});
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    try {
      await createUnitat.mutateAsync({
        referencia,
        planta: planta || undefined,
        porta: porta || undefined,
        superficie: superficie ? Number(superficie) : undefined,
        rendaBase: rendaBase ? Number(rendaBase) : undefined,
      });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (error) {
      if (error instanceof ApiFetchError) {
        setFieldErrors(error.fields ?? {});
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Afegir unitat</DialogTitle>
            <DialogDescription>Registra una nova unitat llogable per a aquesta propietat.</DialogDescription>
          </DialogHeader>

          <FormField label="Referència" required error={fieldErrors.referencia}>
            <Input value={referencia} onChange={(event) => setReferencia(event.target.value)} required />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Planta" error={fieldErrors.planta}>
              <Input value={planta} onChange={(event) => setPlanta(event.target.value)} />
            </FormField>
            <FormField label="Porta" error={fieldErrors.porta}>
              <Input value={porta} onChange={(event) => setPorta(event.target.value)} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Superfície (m²)" error={fieldErrors.superficie}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={superficie}
                onChange={(event) => setSuperficie(event.target.value)}
              />
            </FormField>
            <FormField label="Renda base (€)" error={fieldErrors.rendaBase}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rendaBase}
                onChange={(event) => setRendaBase(event.target.value)}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" loading={createUnitat.isPending}>
              Afegir unitat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
