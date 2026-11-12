'use client';

import * as React from 'react';
import Link from 'next/link';

import { useDesarTitulars, useTitularsPropietat, type TitularPropietat } from '@/hooks/use-propietaris';
import { ApiFetchError } from '@/hooks/api-client';
import { DataTable, EmptyState, LoadingSkeleton } from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';

const COLUMNES: ColumnDef<TitularPropietat>[] = [
  {
    id: 'nom',
    header: 'Propietari',
    cell: (row) => (
      <Link href={`/propietaris/${row.personaId}`} className="underline-offset-4 hover:underline">
        {row.nom}
      </Link>
    ),
  },
  { id: 'percentatge', header: 'Titularitat', cell: (row) => `${row.percentatge}%` },
];

interface TitularsSectionProps {
  propietatId: string;
  canWrite: boolean;
}

/**
 * Titulars d'una propietat. Els copropietaris nous s'afegeixen des de la fitxa del
 * propietari ("Associar propietat"); aquí se'n reparteixen els percentatges i se'n treuen.
 */
export function TitularsSection({ propietatId, canWrite }: TitularsSectionProps) {
  const { data: titulars, isLoading } = useTitularsPropietat(propietatId);
  const [editant, setEditant] = React.useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Titulars</h2>
        {canWrite && !editant && titulars && titulars.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setEditant(true)}>
            Editar titulars
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="table" columns={2} rows={2} />
      ) : !titulars || titulars.length === 0 ? (
        <EmptyState title="Aquesta propietat encara no té cap titular. Associa-la des de la fitxa d'un propietari." />
      ) : editant ? (
        <EditorTitulars propietatId={propietatId} titulars={titulars} onClose={() => setEditant(false)} />
      ) : (
        <DataTable columns={COLUMNES} data={titulars} getRowId={(row) => row.personaId} />
      )}
    </section>
  );
}

interface FilaEditor {
  personaId: string;
  nom: string;
  percentatge: string;
}

function EditorTitulars({
  propietatId,
  titulars,
  onClose,
}: {
  propietatId: string;
  titulars: TitularPropietat[];
  onClose: () => void;
}) {
  const desar = useDesarTitulars();
  const [files, setFiles] = React.useState<FilaEditor[]>(() =>
    titulars.map((titular) => ({ ...titular, percentatge: String(titular.percentatge) }))
  );
  const [error, setError] = React.useState<string | undefined>(undefined);

  const total = files.reduce((suma, fila) => suma + (Number(fila.percentatge) || 0), 0);
  const quadra = Math.abs(total - 100) < 0.001;
  const diferencia = Math.round((100 - total) * 100) / 100;
  const totsPositius = files.every((fila) => Number(fila.percentatge) > 0);

  function treure(personaId: string) {
    setFiles((prev) => {
      const resta = prev.filter((fila) => fila.personaId !== personaId);
      // Si en queda un de sol, n'és el titular únic.
      return resta.length === 1 ? [{ ...resta[0], percentatge: '100' }] : resta;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      await desar.mutateAsync({
        propietatId,
        titulars: files.map((fila) => ({ personaId: fila.personaId, percentatge: Number(fila.percentatge) })),
      });
      toast({ title: 'Titularitat desada' });
      onClose();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-3 rounded-lg border border-border p-4" noValidate>
      {files.map((fila) => (
        <div key={fila.personaId} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium text-foreground">
            {fila.nom} (%)
            <Input
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={fila.percentatge}
              onChange={(event) =>
                setFiles((prev) =>
                  prev.map((f) => (f.personaId === fila.personaId ? { ...f, percentatge: event.target.value } : f))
                )
              }
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={files.length === 1}
            title={files.length === 1 ? 'Una propietat ha de tenir com a mínim un titular.' : undefined}
            onClick={() => treure(fila.personaId)}
          >
            Treure
          </Button>
        </div>
      ))}

      <p role="status" className={quadra ? 'text-sm text-muted-foreground' : 'text-sm font-medium text-destructive'}>
        {quadra
          ? 'Els percentatges sumen 100%.'
          : diferencia > 0
            ? `Falta un ${diferencia}% per arribar al 100%.`
            : `Sobra un ${-diferencia}% per arribar al 100%.`}
      </p>
      {files.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Una propietat ha de tenir com a mínim un titular. Per canviar-lo, associa primer el nou propietari.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={desar.isPending} disabled={!quadra || !totsPositius}>
          Desar
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel·lar
        </Button>
      </div>
    </form>
  );
}
