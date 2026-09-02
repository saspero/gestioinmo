'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useCreateDespesa, type CrearDespesaInput } from '@/hooks/use-despeses';
import { useListPropietats } from '@/hooks/use-propietats';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { CATEGORIA_DESPESA_OPTIONS } from '@/features/despeses/types';

type FormValues = {
  propietatId: string;
  unitatId: string;
  incidenciaId: string;
  categoria: string;
  concepte: string;
  import: string;
  dataDespesa: string;
  proveidor: string;
  facturaUrl: string;
  repercutiblePropietari: boolean;
  notes: string;
};

const INITIAL_VALUES: FormValues = {
  propietatId: '',
  unitatId: '',
  incidenciaId: '',
  categoria: 'altres',
  concepte: '',
  import: '',
  dataDespesa: '',
  proveidor: '',
  facturaUrl: '',
  repercutiblePropietari: true,
  notes: '',
};

interface DespesaFormProps {
  propietatIdInicial?: string;
}

export function DespesaForm({ propietatIdInicial }: DespesaFormProps) {
  const router = useRouter();
  const createDespesa = useCreateDespesa();
  const { data: propietats } = useListPropietats({ pageSize: 100 });
  const [values, setValues] = React.useState<FormValues>({
    ...INITIAL_VALUES,
    propietatId: propietatIdInicial ?? '',
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setFieldErrors({});

    const input: CrearDespesaInput = {
      propietatId: values.propietatId,
      unitatId: values.unitatId || undefined,
      incidenciaId: values.incidenciaId || undefined,
      categoria: values.categoria as CrearDespesaInput['categoria'],
      concepte: values.concepte,
      import: Number(values.import),
      dataDespesa: values.dataDespesa,
      proveidor: values.proveidor || undefined,
      facturaUrl: values.facturaUrl || undefined,
      repercutiblePropietari: values.repercutiblePropietari,
      notes: values.notes || undefined,
    };

    try {
      const despesa = await createDespesa.mutateAsync(input);
      toast({ title: 'Despesa creada' });
      router.push(`/despeses/${despesa.id}`);
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

      <FormField label="Propietat" required error={fieldErrors.propietatId}>
        <Select value={values.propietatId} onChange={(event) => setField('propietatId', event.target.value)} required>
          <option value="">Selecciona una propietat…</option>
          {(propietats?.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.referencia} — {p.adreca}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Unitat" description="Opcional (UUID)" error={fieldErrors.unitatId}>
          <Input value={values.unitatId} onChange={(event) => setField('unitatId', event.target.value)} />
        </FormField>
        <FormField label="Incidència relacionada" description="Opcional (UUID)" error={fieldErrors.incidenciaId}>
          <Input value={values.incidenciaId} onChange={(event) => setField('incidenciaId', event.target.value)} />
        </FormField>
      </div>

      <FormField label="Categoria" required error={fieldErrors.categoria}>
        <Select value={values.categoria} onChange={(event) => setField('categoria', event.target.value)}>
          {CATEGORIA_DESPESA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Concepte" required error={fieldErrors.concepte}>
        <Input value={values.concepte} onChange={(event) => setField('concepte', event.target.value)} required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Import (€)" required error={fieldErrors.import}>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={values.import}
            onChange={(event) => setField('import', event.target.value)}
            required
          />
        </FormField>
        <FormField label="Data" required error={fieldErrors.dataDespesa}>
          <Input
            type="date"
            value={values.dataDespesa}
            onChange={(event) => setField('dataDespesa', event.target.value)}
            required
          />
        </FormField>
      </div>

      <FormField label="Proveïdor" error={fieldErrors.proveidor}>
        <Input value={values.proveidor} onChange={(event) => setField('proveidor', event.target.value)} />
      </FormField>

      <FormField label="URL de la factura" description="Opcional" error={fieldErrors.facturaUrl}>
        <Input value={values.facturaUrl} onChange={(event) => setField('facturaUrl', event.target.value)} />
      </FormField>

      <div className="flex items-center gap-2">
        <Checkbox
          id="repercutible"
          checked={values.repercutiblePropietari}
          onChange={(event) => setField('repercutiblePropietari', event.target.checked)}
        />
        <label htmlFor="repercutible" className="text-sm font-medium">
          Repercutible al propietari
        </label>
      </div>

      <FormField label="Notes" error={fieldErrors.notes}>
        <Textarea value={values.notes} onChange={(event) => setField('notes', event.target.value)} />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" loading={createDespesa.isPending}>
          Crear despesa
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/despeses')}>
          Cancel·lar
        </Button>
      </div>
    </form>
  );
}
