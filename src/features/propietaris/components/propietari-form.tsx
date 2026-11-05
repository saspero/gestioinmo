'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  useCreatePropietari,
  useUpdatePropietari,
  type Propietari,
  type PropietariInput,
} from '@/hooks/use-propietaris';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type Camp = keyof PropietariInput;

const CAMPS: Camp[] = ['nom', 'cognoms', 'nif', 'email', 'telefon', 'iban', 'adreca', 'notes'];

function valorsInicials(propietari?: Propietari): Record<Camp, string> {
  return Object.fromEntries(CAMPS.map((camp) => [camp, propietari?.[camp] ?? ''])) as Record<Camp, string>;
}

function ambValor(values: Record<Camp, string>): PropietariInput {
  return {
    nom: values.nom,
    cognoms: values.cognoms || undefined,
    nif: values.nif || undefined,
    email: values.email || undefined,
    telefon: values.telefon || undefined,
    iban: values.iban || undefined,
    adreca: values.adreca || undefined,
    notes: values.notes || undefined,
  };
}

interface FormBodyProps {
  propietari?: Propietari;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: PropietariInput) => Promise<void>;
  onCancel: () => void;
}

function PropietariFormBody({ propietari, submitLabel, pending, onSubmit, onCancel }: FormBodyProps) {
  const [values, setValues] = React.useState(() => valorsInicials(propietari));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

  const bind = (camp: Camp) => ({
    value: values[camp],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((prev) => ({ ...prev, [camp]: event.target.value })),
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setFieldErrors({});
    try {
      await onSubmit(ambValor(values));
    } catch (error) {
      if (error instanceof ApiFetchError) {
        setFieldErrors(error.fields ?? {});
        if (error.code !== 'VALIDATION_ERROR') setFormError(error.message);
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
        <FormField label="Nom o raó social" required error={fieldErrors.nom}>
          <Input {...bind('nom')} required />
        </FormField>
        <FormField label="Cognoms" error={fieldErrors.cognoms}>
          <Input {...bind('cognoms')} />
        </FormField>
      </div>

      <FormField label="NIF/CIF" error={fieldErrors.nif}>
        <Input {...bind('nif')} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Email" error={fieldErrors.email}>
          <Input type="email" {...bind('email')} />
        </FormField>
        <FormField label="Telèfon" error={fieldErrors.telefon}>
          <Input {...bind('telefon')} />
        </FormField>
      </div>

      <FormField label="IBAN" error={fieldErrors.iban}>
        <Input {...bind('iban')} />
      </FormField>
      <FormField label="Adreça" error={fieldErrors.adreca}>
        <Input {...bind('adreca')} />
      </FormField>
      <FormField label="Notes" error={fieldErrors.notes}>
        <Textarea {...bind('notes')} />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel·lar
        </Button>
      </div>
    </form>
  );
}

export function NouPropietariForm() {
  const router = useRouter();
  const crear = useCreatePropietari();

  return (
    <PropietariFormBody
      submitLabel="Crear propietari"
      pending={crear.isPending}
      onCancel={() => router.push('/propietaris')}
      onSubmit={async (input) => {
        const propietari = await crear.mutateAsync(input);
        toast({ title: 'Propietari creat', description: `S'ha creat "${propietari.nom}".` });
        router.push(`/propietaris/${propietari.id}`);
      }}
    />
  );
}

export function EditarPropietariForm({ propietari, onClose }: { propietari: Propietari; onClose: () => void }) {
  const actualitzar = useUpdatePropietari(propietari.id);

  return (
    <PropietariFormBody
      propietari={propietari}
      submitLabel="Desar canvis"
      pending={actualitzar.isPending}
      onCancel={onClose}
      onSubmit={async (input) => {
        await actualitzar.mutateAsync(input);
        toast({ title: 'Propietari actualitzat' });
        onClose();
      }}
    />
  );
}
