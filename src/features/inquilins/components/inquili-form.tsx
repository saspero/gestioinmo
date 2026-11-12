'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useCreateInquili, useUpdateInquili, type CrearInquiliInput, type Inquili } from '@/hooks/use-inquilins';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import {
  DadesIdentificacio,
  identificacioInput,
  valorOpcional,
  valorsIdentificacio,
} from '@/features/persones/components/dades-identificacio';

type FormValues = {
  email: string;
  telefon: string;
  iban: string;
  adreca: string;
  notes: string;
};

const INITIAL_VALUES: FormValues = {
  email: '',
  telefon: '',
  iban: '',
  adreca: '',
  notes: '',
};

function valorsInicials(inquili?: Inquili): FormValues {
  if (!inquili) return INITIAL_VALUES;
  return {
    email: inquili.email ?? '',
    telefon: inquili.telefon ?? '',
    iban: inquili.iban ?? '',
    adreca: inquili.adreca ?? '',
    notes: inquili.notes ?? '',
  };
}

interface InquiliFormProps {
  /** Amb un inquilí, el formulari l'edita; sense, en crea un de nou. */
  inquili?: Inquili;
  /** En edició, tanca el formulari (en desar o cancel·lar). */
  onClose?: () => void;
}

export function InquiliForm({ inquili, onClose }: InquiliFormProps = {}) {
  const router = useRouter();
  const createInquili = useCreateInquili();
  const updateInquili = useUpdateInquili(inquili?.id ?? '');
  const editant = inquili !== undefined;
  const pending = editant ? updateInquili.isPending : createInquili.isPending;
  const [identificacio, setIdentificacio] = React.useState(() => valorsIdentificacio(inquili));
  const [values, setValues] = React.useState<FormValues>(() => valorsInicials(inquili));
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
      ...identificacioInput(identificacio, editant),
      email: valorOpcional(values.email, editant),
      telefon: valorOpcional(values.telefon, editant),
      iban: valorOpcional(values.iban, editant),
      adreca: valorOpcional(values.adreca, editant),
      notes: valorOpcional(values.notes, editant),
    };

    try {
      if (editant) {
        await updateInquili.mutateAsync(input);
        toast({ title: 'Inquilí actualitzat' });
        onClose?.();
      } else {
        const creat = await createInquili.mutateAsync(input);
        toast({ title: 'Inquilí creat', description: `S'ha creat "${creat.nom}".` });
        router.push(`/inquilins/${creat.id}`);
      }
    } catch (error) {
      if (error instanceof ApiFetchError) {
        setFieldErrors(error.fields ?? {});
        // Ex: "Ja existeix un inquilí amb aquest NIF/NIE." (docs/ux-flows.md §3.4). Els
        // errors de validació ja surten sota cada camp.
        if (error.code !== 'VALIDATION_ERROR') {
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

      <DadesIdentificacio
        values={identificacio}
        onChange={(camp, valor) => setIdentificacio((prev) => ({ ...prev, [camp]: valor }))}
        errors={fieldErrors}
      />

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
        <Button type="submit" loading={pending}>
          {editant ? 'Desar canvis' : 'Crear inquilí'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (editant ? onClose?.() : router.push('/inquilins'))}
        >
          Cancel·lar
        </Button>
      </div>
    </form>
  );
}
