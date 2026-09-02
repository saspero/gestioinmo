'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useCreatePropietat, type CrearPropietatInput } from '@/hooks/use-propietats';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { TIPUS_PROPIETAT_OPTIONS } from '@/features/propietats/types';

type FormValues = {
  referencia: string;
  tipus: string;
  adreca: string;
  poblacio: string;
  cp: string;
  superficie: string;
  habitacions: string;
  banys: string;
  ascensor: boolean;
  certEnergetic: string;
  notes: string;
};

const INITIAL_VALUES: FormValues = {
  referencia: '',
  tipus: 'pis',
  adreca: '',
  poblacio: '',
  cp: '',
  superficie: '',
  habitacions: '',
  banys: '',
  ascensor: false,
  certEnergetic: '',
  notes: '',
};

export function PropietatForm() {
  const router = useRouter();
  const createPropietat = useCreatePropietat();
  const [values, setValues] = React.useState<FormValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setFieldErrors({});

    const input: CrearPropietatInput = {
      referencia: values.referencia,
      tipus: values.tipus,
      adreca: values.adreca,
      poblacio: values.poblacio || undefined,
      cp: values.cp || undefined,
      superficie: values.superficie ? Number(values.superficie) : undefined,
      habitacions: values.habitacions ? Number(values.habitacions) : undefined,
      banys: values.banys ? Number(values.banys) : undefined,
      ascensor: values.ascensor,
      certEnergetic: values.certEnergetic || undefined,
      notes: values.notes || undefined,
    };

    try {
      const propietat = await createPropietat.mutateAsync(input);
      toast({ title: 'Propietat creada', description: `S'ha creat "${propietat.referencia}".` });
      router.push(`/propietats/${propietat.id}`);
    } catch (error) {
      if (error instanceof ApiFetchError) {
        setFormError(error.code === 'CONFLICT' ? error.message : undefined);
        setFieldErrors(error.fields ?? {});
        if (error.code !== 'CONFLICT' && error.code !== 'VALIDATION_ERROR') {
          setFormError(error.message);
        }
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

      <FormField label="Referència" required error={fieldErrors.referencia}>
        <Input
          value={values.referencia}
          onChange={(event) => setField('referencia', event.target.value)}
          required
        />
      </FormField>

      <FormField label="Tipus" required error={fieldErrors.tipus}>
        <Select value={values.tipus} onChange={(event) => setField('tipus', event.target.value)}>
          {TIPUS_PROPIETAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Adreça" required error={fieldErrors.adreca}>
        <Input value={values.adreca} onChange={(event) => setField('adreca', event.target.value)} required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Població" error={fieldErrors.poblacio}>
          <Input value={values.poblacio} onChange={(event) => setField('poblacio', event.target.value)} />
        </FormField>
        <FormField label="Codi postal" error={fieldErrors.cp}>
          <Input value={values.cp} onChange={(event) => setField('cp', event.target.value)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Superfície (m²)" error={fieldErrors.superficie}>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={values.superficie}
            onChange={(event) => setField('superficie', event.target.value)}
          />
        </FormField>
        <FormField label="Habitacions" error={fieldErrors.habitacions}>
          <Input
            type="number"
            min="0"
            step="1"
            value={values.habitacions}
            onChange={(event) => setField('habitacions', event.target.value)}
          />
        </FormField>
        <FormField label="Banys" error={fieldErrors.banys}>
          <Input
            type="number"
            min="0"
            step="1"
            value={values.banys}
            onChange={(event) => setField('banys', event.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Certificat energètic" error={fieldErrors.certEnergetic}>
        <Input value={values.certEnergetic} onChange={(event) => setField('certEnergetic', event.target.value)} />
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox
          id="ascensor"
          checked={values.ascensor}
          onChange={(event) => setField('ascensor', event.target.checked)}
        />
        <label htmlFor="ascensor" className="text-sm font-medium">
          Té ascensor
        </label>
      </div>

      <FormField label="Notes" error={fieldErrors.notes}>
        <Textarea value={values.notes} onChange={(event) => setField('notes', event.target.value)} />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" loading={createPropietat.isPending}>
          Crear propietat
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/propietats')}>
          Cancel·lar
        </Button>
      </div>
    </form>
  );
}
