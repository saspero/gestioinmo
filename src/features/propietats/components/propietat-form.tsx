'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  useCreatePropietat,
  useUpdatePropietat,
  type ActualitzarPropietatInput,
  type CrearPropietatInput,
  type Propietat,
} from '@/hooks/use-propietats';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { TIPUS_PROPIETAT_OPTIONS, TIPUS_SOL_OPTIONS } from '@/features/propietats/types';
import {
  CAMPS_PER_TIPUS,
  tipusPropietatEnum,
  type CampPerTipus,
  type TipusPropietat,
} from '@/lib/validations/propietats';

type FormValues = {
  referencia: string;
  tipus: TipusPropietat;
  adreca: string;
  poblacio: string;
  cp: string;
  referenciaCadastral: string;
  superficie: string;
  habitacions: string;
  banys: string;
  ascensor: boolean;
  certEnergetic: string;
  numeroPlaca: string;
  planta: string;
  numPisos: string;
  superficieEdificable: string;
  tipusSol: string;
  notes: string;
};

const INITIAL_VALUES: FormValues = {
  referencia: '',
  tipus: 'pis',
  adreca: '',
  poblacio: '',
  cp: '',
  referenciaCadastral: '',
  superficie: '',
  habitacions: '',
  banys: '',
  ascensor: false,
  certEnergetic: '',
  numeroPlaca: '',
  planta: '',
  numPisos: '',
  superficieEdificable: '',
  tipusSol: '',
  notes: '',
};

const textInicial = (valor: string | number | null) => (valor === null ? '' : String(valor));

function valorsInicials(propietat?: Propietat): FormValues {
  if (!propietat) return INITIAL_VALUES;
  const tipus = tipusPropietatEnum.safeParse(propietat.tipus);
  return {
    referencia: propietat.referencia,
    tipus: tipus.success ? tipus.data : 'altres',
    adreca: propietat.adreca,
    poblacio: textInicial(propietat.poblacio),
    cp: textInicial(propietat.cp),
    referenciaCadastral: textInicial(propietat.referenciaCadastral),
    superficie: textInicial(propietat.superficie),
    habitacions: textInicial(propietat.habitacions),
    banys: textInicial(propietat.banys),
    ascensor: propietat.ascensor,
    certEnergetic: textInicial(propietat.certEnergetic),
    numeroPlaca: textInicial(propietat.numeroPlaca),
    planta: textInicial(propietat.planta),
    numPisos: textInicial(propietat.numPisos),
    superficieEdificable: textInicial(propietat.superficieEdificable),
    tipusSol: textInicial(propietat.tipusSol),
    notes: textInicial(propietat.notes),
  };
}

/**
 * Converteix el formulari en l'entrada de l'API. Només hi van els camps del tipus triat.
 * En una alta, un camp buit no s'envia; en una edició s'envia `null` perquè s'esborri,
 * i els camps que el tipus no té també s'esborren (el servidor fa el mateix).
 */
export function construirInput(values: FormValues, edicio: boolean): ActualitzarPropietatInput {
  const propis = new Set<CampPerTipus>(CAMPS_PER_TIPUS[values.tipus]);
  const buit = edicio ? null : undefined;
  const text = (valor: string) => valor || buit;
  const numero = (valor: string) => (valor ? Number(valor) : buit);
  const si = <T,>(camp: CampPerTipus, valor: T) => (propis.has(camp) ? valor : buit);
  return {
    referencia: values.referencia,
    tipus: values.tipus,
    adreca: values.adreca,
    poblacio: text(values.poblacio),
    cp: text(values.cp),
    referenciaCadastral: text(values.referenciaCadastral),
    superficie: si('superficie', numero(values.superficie)),
    habitacions: si('habitacions', numero(values.habitacions)),
    banys: si('banys', numero(values.banys)),
    ascensor: propis.has('ascensor') ? values.ascensor : false,
    certEnergetic: si('certEnergetic', text(values.certEnergetic)),
    numeroPlaca: si('numeroPlaca', text(values.numeroPlaca)),
    planta: si('planta', text(values.planta)),
    numPisos: si('numPisos', numero(values.numPisos)),
    superficieEdificable: si('superficieEdificable', numero(values.superficieEdificable)),
    tipusSol: si('tipusSol', (values.tipusSol || buit) as ActualitzarPropietatInput['tipusSol']),
    notes: text(values.notes),
  };
}

interface PropietatFormProps {
  /** Amb una propietat, el formulari l'edita; sense, en crea una de nova. */
  propietat?: Propietat;
  /** En edició, tanca el formulari (en desar o cancel·lar). */
  onClose?: () => void;
}

export function PropietatForm({ propietat, onClose }: PropietatFormProps = {}) {
  const router = useRouter();
  const createPropietat = useCreatePropietat();
  const updatePropietat = useUpdatePropietat(propietat?.id ?? '');
  const editant = propietat !== undefined;
  const pending = editant ? updatePropietat.isPending : createPropietat.isPending;
  const [values, setValues] = React.useState<FormValues>(() => valorsInicials(propietat));
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | undefined>(undefined);

  const propis = new Set<CampPerTipus>(CAMPS_PER_TIPUS[values.tipus]);
  const te = (camp: CampPerTipus) => propis.has(camp);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const camp = (key: Exclude<keyof FormValues, 'ascensor' | 'tipus'>) => ({
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setField(key, event.target.value),
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setFieldErrors({});

    try {
      if (editant) {
        await updatePropietat.mutateAsync(construirInput(values, true));
        toast({ title: 'Canvis desats', description: "S'ha actualitzat la propietat." });
        onClose?.();
      } else {
        const nova = await createPropietat.mutateAsync(construirInput(values, false) as CrearPropietatInput);
        toast({ title: 'Propietat creada', description: `S'ha creat "${nova.referencia}".` });
        router.push(`/propietats/${nova.id}`);
      }
    } catch (error) {
      if (error instanceof ApiFetchError) {
        setFieldErrors(error.fields ?? {});
        if (error.code !== 'VALIDATION_ERROR') setFormError(error.message);
      } else {
        setFormError("S'ha produït un error inesperat. Torna-ho a provar més tard.");
      }
    }
  }

  const superficieLabel = values.tipus === 'solar' ? 'Superfície del solar (m²)' : 'Superfície (m²)';

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Referència" required error={fieldErrors.referencia}>
          <Input {...camp('referencia')} required />
        </FormField>
        <FormField label="Tipus" required error={fieldErrors.tipus}>
          <Select value={values.tipus} onChange={(event) => setField('tipus', event.target.value as TipusPropietat)}>
            {TIPUS_PROPIETAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Adreça" required error={fieldErrors.adreca}>
        <Input {...camp('adreca')} required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Població" error={fieldErrors.poblacio}>
          <Input {...camp('poblacio')} />
        </FormField>
        <FormField label="Codi postal" error={fieldErrors.cp}>
          <Input {...camp('cp')} />
        </FormField>
      </div>

      <FormField label="Referència cadastral" description="Si se'n té." error={fieldErrors.referenciaCadastral}>
        <Input {...camp('referenciaCadastral')} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {te('superficie') && (
          <FormField label={superficieLabel} error={fieldErrors.superficie}>
            <Input type="number" min="0" step="0.01" {...camp('superficie')} />
          </FormField>
        )}
        {te('superficieEdificable') && (
          <FormField label="Superfície edificable (m²)" error={fieldErrors.superficieEdificable}>
            <Input type="number" min="0" step="0.01" {...camp('superficieEdificable')} />
          </FormField>
        )}
        {te('tipusSol') && (
          <FormField label="Tipus de sòl" error={fieldErrors.tipusSol}>
            <Select {...camp('tipusSol')}>
              <option value="">Sense indicar</option>
              {TIPUS_SOL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {te('habitacions') && (
          <FormField label="Habitacions" error={fieldErrors.habitacions}>
            <Input type="number" min="0" step="1" {...camp('habitacions')} />
          </FormField>
        )}
        {te('banys') && (
          <FormField label="Banys" error={fieldErrors.banys}>
            <Input type="number" min="0" step="1" {...camp('banys')} />
          </FormField>
        )}
        {te('numPisos') && (
          <FormField label="Nombre de pisos" error={fieldErrors.numPisos}>
            <Input type="number" min="1" step="1" {...camp('numPisos')} />
          </FormField>
        )}
        {te('numeroPlaca') && (
          <FormField label="Número de plaça" error={fieldErrors.numeroPlaca}>
            <Input {...camp('numeroPlaca')} />
          </FormField>
        )}
        {te('planta') && (
          <FormField label="Planta" error={fieldErrors.planta}>
            <Input {...camp('planta')} />
          </FormField>
        )}
      </div>

      {te('certEnergetic') && (
        <FormField label="Certificat energètic" error={fieldErrors.certEnergetic}>
          <Input {...camp('certEnergetic')} />
        </FormField>
      )}

      {te('ascensor') && (
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
      )}

      <FormField label="Notes" error={fieldErrors.notes}>
        <Textarea {...camp('notes')} />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {editant ? 'Desar canvis' : 'Crear propietat'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (editant ? onClose?.() : router.push('/propietats'))}
        >
          Cancel·lar
        </Button>
      </div>
    </form>
  );
}
