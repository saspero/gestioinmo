'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  useIncidencia,
  useUpdateIncidencia,
  useResoldreIncidencia,
  useComentarisIncidencia,
  useCreateComentariIncidencia,
} from '@/hooks/use-incidencies';
import { ApiFetchError } from '@/hooks/api-client';
import { LoadingSkeleton, ErrorState, StatusBadge, FormField, EmptyState } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
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
import { ESTAT_INCIDENCIA_EDITABLE_OPTIONS, PRIORITAT_OPTIONS } from '@/features/incidencies/types';

interface IncidenciaDetailViewProps {
  id: string;
  canWrite: boolean;
  canReadCost: boolean;
}

export function IncidenciaDetailView({ id, canWrite, canReadCost }: IncidenciaDetailViewProps) {
  const { data: incidencia, isLoading, isError, refetch } = useIncidencia(id);
  const updateIncidencia = useUpdateIncidencia(id);
  const [resoldreOpen, setResoldreOpen] = React.useState(false);

  if (isLoading) {
    return <LoadingSkeleton variant="detail" sections={2} />;
  }

  if (isError || !incidencia) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  async function handleEstatChange(nouEstat: string) {
    try {
      await updateIncidencia.mutateAsync({ estat: nouEstat as 'oberta' | 'assignada' | 'en_curs' });
      toast({ title: `Incidència ${nouEstat === 'en_curs' ? 'en curs' : nouEstat}` });
    } catch (error) {
      const message =
        error instanceof ApiFetchError ? error.message : "S'ha produït un error inesperat. Torna-ho a provar més tard.";
      toast({ variant: 'destructive', title: "No s'ha pogut canviar l'estat", description: message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Títol" value={incidencia.titol} className="sm:col-span-2 lg:col-span-3" />
          <Field label="Prioritat" value={<StatusBadge type="prioritat" value={incidencia.prioritat} />} />
          <Field label="Estat" value={<StatusBadge type="incidencia" value={incidencia.estat} />} />
          <Field label="Assignat a" value={incidencia.assignatA ?? '—'} />
          {canReadCost && <Field label="Cost estimat" value={incidencia.costEstimat ? `${incidencia.costEstimat} €` : '—'} />}
          {canReadCost && <Field label="Cost final" value={incidencia.costFinal ? `${incidencia.costFinal} €` : '—'} />}
          {incidencia.descripcio && (
            <Field label="Descripció" value={incidencia.descripcio} className="sm:col-span-2 lg:col-span-3" />
          )}
        </CardContent>
      </Card>

      {canWrite && incidencia.estat !== 'resolta' && (
        <div className="flex flex-wrap items-center gap-3">
          <FormField label="Canviar estat" className="max-w-[12rem]">
            <Select value={incidencia.estat} onChange={(event) => handleEstatChange(event.target.value)}>
              {ESTAT_INCIDENCIA_EDITABLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
          <Button variant="destructive" onClick={() => setResoldreOpen(true)}>
            Marcar com a resolta
          </Button>
        </div>
      )}

      {incidencia.estat === 'resolta' && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            Aquesta incidència ja està resolta i no es pot reobrir. Crea&apos;n una de nova si el problema persisteix.
          </p>
          <Link
            href={`/incidencies/nou?unitatId=${incidencia.unitatId}${incidencia.contracteId ? `&contracteId=${incidencia.contracteId}` : ''}`}
            className="self-start text-sm font-medium text-primary hover:underline"
          >
            Crear incidència relacionada
          </Link>
        </div>
      )}

      <ComentarisSection incidenciaId={id} />

      <ResoldreDialog incidenciaId={id} open={resoldreOpen} onOpenChange={setResoldreOpen} />
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

function ComentarisSection({ incidenciaId }: { incidenciaId: string }) {
  const { data: comentaris, isLoading, isError, refetch } = useComentarisIncidencia(incidenciaId);
  const createComentari = useCreateComentariIncidencia(incidenciaId);
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) {
      setError('Escriu un comentari abans d’enviar-lo.');
      return;
    }
    setError(undefined);
    try {
      await createComentari.mutateAsync({ text: text.trim() });
      setText('');
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Comentaris</h2>

      {isError ? (
        <ErrorState title="No s'han pogut carregar els comentaris." onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingSkeleton variant="detail" sections={1} />
      ) : (comentaris?.length ?? 0) === 0 ? (
        <EmptyState title="Encara no hi ha cap comentari." />
      ) : (
        <ul className="flex flex-col gap-3">
          {(comentaris ?? []).map((comentari) => (
            <li key={comentari.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="text-foreground">{comentari.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">{comentari.createdAt}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Textarea
          placeholder="Afegeix un comentari…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="Nou comentari"
        />
        <Button type="submit" size="sm" className="self-start" loading={createComentari.isPending}>
          Comentar
        </Button>
      </form>
    </div>
  );
}

interface ResoldreDialogProps {
  incidenciaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ResoldreDialog({ incidenciaId, open, onOpenChange }: ResoldreDialogProps) {
  const resoldreIncidencia = useResoldreIncidencia(incidenciaId);
  const [costFinal, setCostFinal] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      await resoldreIncidencia.mutateAsync({ costFinal: costFinal ? Number(costFinal) : undefined });
      toast({ title: 'Incidència resolta' });
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
            <DialogTitle>Marcar com a resolta</DialogTitle>
            <DialogDescription>
              Un cop resolta, la incidència no es pot reobrir: caldrà crear-ne una de nova si el problema persisteix.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <FormField label="Cost final (€)" description="Opcional">
            <Input type="number" min="0" step="0.01" value={costFinal} onChange={(event) => setCostFinal(event.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" variant="destructive" loading={resoldreIncidencia.isPending}>
              Marcar com a resolta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
