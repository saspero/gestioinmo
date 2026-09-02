'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useCreateIncidencia, type CrearIncidenciaInput } from '@/hooks/use-incidencies';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { PRIORITAT_OPTIONS } from '@/features/incidencies/types';
import { UnitatPicker } from '@/features/incidencies/components/unitat-picker';

interface IncidenciaFormProps {
  propietatIdInicial?: string;
  unitatIdInicial?: string;
  contracteIdInicial?: string;
}

export function IncidenciaForm({ propietatIdInicial, unitatIdInicial, contracteIdInicial }: IncidenciaFormProps) {
  const router = useRouter();
  const createIncidencia = useCreateIncidencia();

  const [propietatId, setPropietatId] = React.useState(propietatIdInicial ?? '');
  const [unitatId, setUnitatId] = React.useState(unitatIdInicial ?? '');
  const [titol, setTitol] = React.useState('');
  const [descripcio, setDescripcio] = React.useState('');
  const [prioritat, setPrioritat] = React.useState('normal');

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setFieldErrors({});

    const input: CrearIncidenciaInput = {
      unitatId,
      contracteId: contracteIdInicial || undefined,
      titol,
      descripcio: descripcio || undefined,
      prioritat: prioritat as CrearIncidenciaInput['prioritat'],
    };

    try {
      const incidencia = await createIncidencia.mutateAsync(input);
      toast({ title: 'Incidència creada' });
      router.push(`/incidencies/${incidencia.id}`);
    } catch (error) {
      if (error instanceof ApiFetchError) {
        setFieldErrors(error.fields ?? {});
        setFormError(error.message);
      } else {
        setFormError("S'ha produït un error inesperat. Torna-ho a provar més tard.");
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <UnitatPicker
        propietatId={propietatId}
        onPropietatChange={(id) => {
          setPropietatId(id);
          setUnitatId('');
        }}
        unitatId={unitatId}
        onUnitatChange={setUnitatId}
        error={fieldErrors.unitatId}
      />

      <FormField label="Títol" required error={fieldErrors.titol}>
        <Input value={titol} onChange={(event) => setTitol(event.target.value)} required />
      </FormField>

      <FormField label="Descripció" error={fieldErrors.descripcio}>
        <Textarea value={descripcio} onChange={(event) => setDescripcio(event.target.value)} />
      </FormField>

      <FormField label="Prioritat" required error={fieldErrors.prioritat}>
        <Select value={prioritat} onChange={(event) => setPrioritat(event.target.value)}>
          {PRIORITAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" loading={createIncidencia.isPending} disabled={!unitatId}>
          Crear incidència
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/incidencies')}>
          Cancel·lar
        </Button>
      </div>
    </form>
  );
}
