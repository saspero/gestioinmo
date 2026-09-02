'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useCreateInquili, type CrearInquiliInput } from '@/hooks/use-inquilins';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type FormValues = {
  nom: string;
  cognoms: string;
  nif: string;
  email: string;
  telefon: string;
  iban: string;
  adreca: string;
  notes: string;
};

const INITIAL_VALUES: FormValues = {
  nom: '',
  cognoms: '',
  nif: '',
  email: '',
  telefon: '',
  iban: '',
  adreca: '',
  notes: '',
};

export function InquiliForm() {
  const router = useRouter();
  const createInquili = useCreateInquili();
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

    const input: CrearInquiliInput = {
      nom: values.nom,
      cognoms: values.cognoms || undefined,
      nif: values.nif || undefined,
      email: values.email || undefined,
      telefon: values.telefon || undefined,
      iban: values.iban || undefined,
      adreca: values.adreca || undefined,
      notes: values.notes || undefined,
    };

    try {
      const inquili = await createInquili.mutateAsync(input);
      toast({ title: 'Inquilí creat', description: `S'ha creat "${inquili.nom}".` });
      router.push(`/inquilins/${inquili.id}`);
    } catch (error) {
      if (error instanceof ApiFetchError) {
        setFieldErrors(error.fields ?? {});
        // "Ja existeix un inquilí amb aquest NIF/NIE." (docs/ux-flows.md §3.4)
        if (error.code === 'CONFLICT' || error.code === 'INTERNAL_ERROR') {
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Nom" required error={fieldErrors.nom}>
          <Input value={values.nom} onChange={(event) => setField('nom', event.target.value)} required />
        </FormField>
        <FormField label="Cognoms" error={fieldErrors.cognoms}>
          <Input value={values.cognoms} onChange={(event) => setField('cognoms', event.target.value)} />
        </FormField>
      </div>

      <FormField label="NIF/NIE" error={fieldErrors.nif}>
        <Input value={values.nif} onChange={(event) => setField('nif', event.target.value)} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Email" error={fieldErrors.email}>
          <Input type="email" value={values.email} onChange={(event) => setField('email', event.target.value)} />
        </FormField>
        <FormField label="Telèfon" error={fieldErrors.telefon}>
          <Input value={values.telefon} onChange={(event) => setField('telefon', event.target.value)} />
        </FormField>
      </div>

      <FormField label="IBAN" error={fieldErrors.iban}>
        <Input value={values.iban} onChange={(event) => setField('iban', event.target.value)} />
      </FormField>

      <FormField label="Adreça" error={fieldErrors.adreca}>
        <Input value={values.adreca} onChange={(event) => setField('adreca', event.target.value)} />
      </FormField>

      <FormField label="Notes" error={fieldErrors.notes}>
        <Textarea value={values.notes} onChange={(event) => setField('notes', event.target.value)} />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" loading={createInquili.isPending}>
          Crear inquilí
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/inquilins')}>
          Cancel·lar
        </Button>
      </div>
    </form>
  );
}
