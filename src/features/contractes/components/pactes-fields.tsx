'use client';

import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type {
  ActualitzarContracteInput,
  Contracte,
  CrearContracteInput,
  TipusActualitzacio,
} from '@/hooks/use-contractes';
import { TIPUS_ACTUALITZACIO_OPTIONS } from '@/features/contractes/types';

/** Pactes del contracte tal com es treballen al formulari (tot en text). */
export interface PactesValues {
  durada: string;
  duradaUnitat: 'anys' | 'mesos';
  prorrogaAutomatica: boolean;
  prorrogaMesos: string;
  duradaMaximaAnys: string;
  preavisDies: string;
  tipusActualitzacio: TipusActualitzacio;
  percentatgePactat: string;
  moblat: boolean;
}

export const PACTES_INICIALS: PactesValues = {
  durada: '',
  duradaUnitat: 'anys',
  prorrogaAutomatica: false,
  prorrogaMesos: '12',
  duradaMaximaAnys: '',
  preavisDies: '30',
  tipusActualitzacio: 'ipc',
  percentatgePactat: '',
  moblat: false,
};

export function valorsPactes(contracte: Contracte): PactesValues {
  const mesos = contracte.duradaMesos;
  const enAnys = mesos !== null && mesos % 12 === 0;
  return {
    durada: mesos === null ? '' : String(enAnys ? mesos / 12 : mesos),
    duradaUnitat: enAnys || mesos === null ? 'anys' : 'mesos',
    prorrogaAutomatica: contracte.prorrogaAutomatica,
    prorrogaMesos: contracte.prorrogaMesos === null ? '12' : String(contracte.prorrogaMesos),
    duradaMaximaAnys:
      contracte.duradaMaximaMesos === null ? '' : String(Math.round((contracte.duradaMaximaMesos / 12) * 100) / 100),
    preavisDies: contracte.preavisDies === null ? '' : String(contracte.preavisDies),
    tipusActualitzacio: contracte.tipusActualitzacio,
    percentatgePactat: contracte.percentatgePactat ?? '',
    moblat: contracte.moblat,
  };
}

/**
 * Converteix el formulari en els camps de l'API. En una alta, un camp buit no s'envia;
 * en una edició s'envia `null` perquè s'esborri.
 */
type CampsPactes =
  | 'duradaMesos'
  | 'prorrogaAutomatica'
  | 'prorrogaMesos'
  | 'duradaMaximaMesos'
  | 'preavisDies'
  | 'tipusActualitzacio'
  | 'percentatgePactat'
  | 'moblat';

export function pactesInput(values: PactesValues, edicio: false): Pick<CrearContracteInput, CampsPactes>;
export function pactesInput(values: PactesValues, edicio: true): Pick<ActualitzarContracteInput, CampsPactes>;
export function pactesInput(values: PactesValues, edicio: boolean): Pick<ActualitzarContracteInput, CampsPactes> {
  const buit = edicio ? null : undefined;
  const enter = (valor: string) => (valor === '' ? buit : Math.round(Number(valor)));
  const duradaMesos =
    values.durada === '' ? buit : Math.round(Number(values.durada) * (values.duradaUnitat === 'anys' ? 12 : 1));
  const prorroga = values.prorrogaAutomatica;
  return {
    duradaMesos,
    prorrogaAutomatica: prorroga,
    prorrogaMesos: prorroga ? enter(values.prorrogaMesos) : buit,
    duradaMaximaMesos: prorroga && values.duradaMaximaAnys !== '' ? Math.round(Number(values.duradaMaximaAnys) * 12) : buit,
    preavisDies: enter(values.preavisDies),
    tipusActualitzacio: values.tipusActualitzacio,
    percentatgePactat:
      values.tipusActualitzacio === 'percentatge_fix' && values.percentatgePactat !== ''
        ? Number(values.percentatgePactat)
        : buit,
    moblat: values.moblat,
  };
}

interface PactesFieldsProps {
  values: PactesValues;
  onChange: (values: PactesValues) => void;
  errors: Record<string, string>;
}

export function PactesFields({ values, onChange, errors }: PactesFieldsProps) {
  const set = <K extends keyof PactesValues>(key: K, value: PactesValues[K]) => onChange({ ...values, [key]: value });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Durada inicial"
          description="Si la indiques, la data de fi es calcula sola."
          error={errors.duradaMesos}
        >
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              step="1"
              value={values.durada}
              onChange={(event) => set('durada', event.target.value)}
              aria-label="Durada inicial"
            />
            <Select
              value={values.duradaUnitat}
              onChange={(event) => set('duradaUnitat', event.target.value as PactesValues['duradaUnitat'])}
              aria-label="Unitat de la durada"
            >
              <option value="anys">anys</option>
              <option value="mesos">mesos</option>
            </Select>
          </div>
        </FormField>
        <FormField label="Preavís per no renovar (dies)" error={errors.preavisDies}>
          <Input
            type="number"
            min="0"
            step="1"
            value={values.preavisDies}
            onChange={(event) => set('preavisDies', event.target.value)}
          />
        </FormField>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="prorroga-automatica"
          checked={values.prorrogaAutomatica}
          onChange={(event) => set('prorrogaAutomatica', event.target.checked)}
        />
        <label htmlFor="prorroga-automatica" className="text-sm font-medium">
          Es prorroga automàticament si ningú el denuncia
        </label>
      </div>

      {values.prorrogaAutomatica && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Cada pròrroga (mesos)" error={errors.prorrogaMesos}>
            <Input
              type="number"
              min="1"
              step="1"
              value={values.prorrogaMesos}
              onChange={(event) => set('prorrogaMesos', event.target.value)}
            />
          </FormField>
          <FormField
            label="Fins a una durada total de (anys)"
            description="Buit si no hi ha límit."
            error={errors.duradaMaximaMesos}
          >
            <Input
              type="number"
              min="1"
              step="1"
              value={values.duradaMaximaAnys}
              onChange={(event) => set('duradaMaximaAnys', event.target.value)}
            />
          </FormField>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Actualització anual de la renda" error={errors.tipusActualitzacio}>
          <Select
            value={values.tipusActualitzacio}
            onChange={(event) => set('tipusActualitzacio', event.target.value as TipusActualitzacio)}
          >
            {TIPUS_ACTUALITZACIO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
        {values.tipusActualitzacio === 'percentatge_fix' && (
          <FormField label="Percentatge pactat (%)" required error={errors.percentatgePactat}>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={values.percentatgePactat}
              onChange={(event) => set('percentatgePactat', event.target.value)}
            />
          </FormField>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="moblat" checked={values.moblat} onChange={(event) => set('moblat', event.target.checked)} />
        <label htmlFor="moblat" className="text-sm font-medium">
          Es lloga moblat
        </label>
      </div>
    </div>
  );
}
