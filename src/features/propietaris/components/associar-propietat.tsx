'use client';

import * as React from 'react';

import { useListPropietats } from '@/hooks/use-propietats';
import { useDesarTitulars, useTitularsPropietat } from '@/hooks/use-propietaris';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

interface AssociarPropietatProps {
  propietariId: string;
  propietariNom: string;
  onClose: () => void;
}

/**
 * Flux "Associar propietat" (docs/ux-flows.md §3.3): els percentatges de tots els
 * copropietaris es desen junts perquè el trigger diferit exigeix que sumin 100%.
 */
export function AssociarPropietat({ propietariId, propietariNom, onClose }: AssociarPropietatProps) {
  const [propietatId, setPropietatId] = React.useState('');
  const [percentatges, setPercentatges] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | undefined>(undefined);

  const { data: propietats } = useListPropietats({ pageSize: 100 });
  const { data: titulars, isLoading } = useTitularsPropietat(propietatId || undefined);
  const desar = useDesarTitulars();

  // El propietari actual s'afegeix a la llista si encara no n'és titular.
  const files = React.useMemo(() => {
    const existents = titulars ?? [];
    return existents.some((titular) => titular.personaId === propietariId)
      ? existents
      : [...existents, { personaId: propietariId, nom: propietariNom, percentatge: existents.length === 0 ? 100 : 0 }];
  }, [titulars, propietariId, propietariNom]);

  const valorDe = (personaId: string, perDefecte: number) => percentatges[personaId] ?? String(perDefecte);
  const total = files.reduce((suma, fila) => suma + (Number(valorDe(fila.personaId, fila.percentatge)) || 0), 0);
  const quadra = Math.abs(total - 100) < 0.001;
  const diferencia = Math.round((100 - total) * 100) / 100;
  const totsPositius = files.every((fila) => Number(valorDe(fila.personaId, fila.percentatge)) > 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      await desar.mutateAsync({
        propietatId,
        titulars: files.map((fila) => ({
          personaId: fila.personaId,
          percentatge: Number(valorDe(fila.personaId, fila.percentatge)),
        })),
      });
      toast({ title: 'Titularitat desada' });
      onClose();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border p-4">
      <FormField label="Propietat" required>
        <Select
          value={propietatId}
          onChange={(event) => {
            setPropietatId(event.target.value);
            setPercentatges({});
          }}
        >
          <option value="">Selecciona una propietat…</option>
          {(propietats?.data ?? []).map((propietat) => (
            <option key={propietat.id} value={propietat.id}>
              {propietat.referencia} — {propietat.adreca}
            </option>
          ))}
        </Select>
      </FormField>

      {propietatId && !isLoading && (
        <>
          {files.map((fila) => (
            <FormField key={fila.personaId} label={`${fila.nom} (%)`}>
              <Input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={valorDe(fila.personaId, fila.percentatge)}
                onChange={(event) =>
                  setPercentatges((prev) => ({ ...prev, [fila.personaId]: event.target.value }))
                }
              />
            </FormField>
          ))}
          <p role="status" className={quadra ? 'text-sm text-muted-foreground' : 'text-sm font-medium text-destructive'}>
            {quadra
              ? 'Els percentatges sumen 100%.'
              : diferencia > 0
                ? `Falta un ${diferencia}% per arribar al 100%.`
                : `Sobra un ${-diferencia}% per arribar al 100%.`}
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={desar.isPending} disabled={!propietatId || !quadra || !totsPositius}>
          Desar
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel·lar
        </Button>
      </div>
    </form>
  );
}
