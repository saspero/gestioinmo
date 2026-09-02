'use client';

import * as React from 'react';

import { useListPagaments, useCreateRemesaPagaments } from '@/hooks/use-pagaments';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField, EmptyState, LoadingSkeleton, ErrorState } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

export function RemesaForm() {
  const { data, isLoading, isError, refetch } = useListPagaments({ estat: 'pendent', pageSize: 100 });
  const createRemesa = useCreateRemesaPagaments();

  const [seleccionats, setSeleccionats] = React.useState<Set<string>>(new Set());
  const [referencia, setReferencia] = React.useState('');
  const [dataEnviament, setDataEnviament] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [creada, setCreada] = React.useState<string | null>(null);

  function toggle(id: string) {
    setSeleccionats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const count = seleccionats.size;
    try {
      const remesa = await createRemesa.mutateAsync({
        referencia,
        pagamentsIds: [...seleccionats],
        dataEnviament: dataEnviament || undefined,
      });
      setCreada(remesa.referencia);
      setSeleccionats(new Set());
      setReferencia('');
      setDataEnviament('');
      toast({ title: 'Remesa creada', description: `S'han agrupat ${count} rebuts.` });
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat. Torna-ho a provar més tard.");
    }
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return <LoadingSkeleton variant="table" columns={4} rows={4} />;
  }

  const pendents = data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {creada && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Remesa &quot;{creada}&quot; creada correctament.
        </div>
      )}

      {pendents.length === 0 ? (
        <EmptyState title="No hi ha cap rebut pendent per agrupar en una remesa." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {pendents.map((pagament) => (
              <li key={pagament.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <Checkbox checked={seleccionats.has(pagament.id)} onChange={() => toggle(pagament.id)} />
                <span className="flex-1">{pagament.concepte}</span>
                <span className="text-muted-foreground">{pagament.dataVenciment}</span>
                <span className="font-medium">{pagament.import} €</span>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Referència de la remesa" required>
              <Input value={referencia} onChange={(event) => setReferencia(event.target.value)} required />
            </FormField>
            <FormField label="Data d'enviament" description="Opcional">
              <Input type="date" value={dataEnviament} onChange={(event) => setDataEnviament(event.target.value)} />
            </FormField>
          </div>

          <Button type="submit" className="self-start" loading={createRemesa.isPending} disabled={seleccionats.size === 0}>
            Agrupar {seleccionats.size > 0 ? `${seleccionats.size} rebuts` : ''} en remesa
          </Button>
        </form>
      )}
    </div>
  );
}
