'use client';

// Bloc d'identificació compartit pels formularis de propietaris i inquilins: persona
// física (nom, cognoms, DNI/NIE) o jurídica (raó social, CIF i representant legal).

import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export interface DadesIdentificacioValues {
  personaJuridica: boolean;
  nom: string;
  cognoms: string;
  nif: string;
  representantNom: string;
  representantNif: string;
  representantCarrec: string;
}

export interface DadesIdentificacioPersona {
  personaJuridica?: boolean;
  nom: string;
  cognoms: string | null;
  nif: string | null;
  representantNom: string | null;
  representantNif: string | null;
  representantCarrec: string | null;
}

export function valorsIdentificacio(persona?: DadesIdentificacioPersona): DadesIdentificacioValues {
  return {
    personaJuridica: persona?.personaJuridica ?? false,
    nom: persona?.nom ?? '',
    cognoms: persona?.cognoms ?? '',
    nif: persona?.nif ?? '',
    representantNom: persona?.representantNom ?? '',
    representantNif: persona?.representantNif ?? '',
    representantCarrec: persona?.representantCarrec ?? '',
  };
}

/** Text del representant legal per a les fitxes de detall: "Nom (NIF), càrrec". */
export function descripcioRepresentant(persona: DadesIdentificacioPersona): string {
  if (!persona.representantNom) return '—';
  const nif = persona.representantNif ? ` (${persona.representantNif})` : '';
  const carrec = persona.representantCarrec ? `, ${persona.representantCarrec}` : '';
  return `${persona.representantNom}${nif}${carrec}`;
}

/** Converteix els valors del formulari en l'entrada de l'API: només envia els camps del tipus triat. */
export function identificacioInput(values: DadesIdentificacioValues) {
  const juridica = values.personaJuridica;
  return {
    personaJuridica: juridica,
    nom: values.nom,
    nif: values.nif || undefined,
    cognoms: juridica ? undefined : values.cognoms || undefined,
    representantNom: juridica ? values.representantNom || undefined : undefined,
    representantNif: juridica ? values.representantNif || undefined : undefined,
    representantCarrec: juridica ? values.representantCarrec || undefined : undefined,
  };
}

interface DadesIdentificacioProps {
  values: DadesIdentificacioValues;
  onChange: <K extends keyof DadesIdentificacioValues>(camp: K, valor: DadesIdentificacioValues[K]) => void;
  errors: Record<string, string>;
}

export function DadesIdentificacio({ values, onChange, errors }: DadesIdentificacioProps) {
  const juridica = values.personaJuridica;
  const text = (camp: Exclude<keyof DadesIdentificacioValues, 'personaJuridica'>) => ({
    value: values[camp],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(camp, event.target.value),
  });

  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-foreground">Tipus de persona</legend>
        <RadioGroup
          name="tipus-persona"
          value={juridica ? 'juridica' : 'fisica'}
          onValueChange={(valor) => onChange('personaJuridica', valor === 'juridica')}
          className="flex flex-wrap gap-6"
        >
          <label className="flex items-center gap-2 text-sm text-foreground">
            <RadioGroupItem value="fisica" />
            Física
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <RadioGroupItem value="juridica" />
            Jurídica (empresa)
          </label>
        </RadioGroup>
      </fieldset>

      {juridica ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Raó social" required error={errors.nom}>
              <Input {...text('nom')} required />
            </FormField>
            <FormField label="CIF" error={errors.nif}>
              <Input {...text('nif')} />
            </FormField>
          </div>
          <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium text-foreground">Representant legal</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Nom i cognoms" error={errors.representantNom}>
                <Input {...text('representantNom')} />
              </FormField>
              <FormField label="NIF" error={errors.representantNif}>
                <Input {...text('representantNif')} />
              </FormField>
            </div>
            <FormField label="Càrrec" description="Per exemple: administrador únic, apoderat." error={errors.representantCarrec}>
              <Input {...text('representantCarrec')} />
            </FormField>
          </fieldset>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Nom" required error={errors.nom}>
              <Input {...text('nom')} required />
            </FormField>
            <FormField label="Cognoms" error={errors.cognoms}>
              <Input {...text('cognoms')} />
            </FormField>
          </div>
          <FormField label="DNI/NIE" error={errors.nif}>
            <Input {...text('nif')} />
          </FormField>
        </>
      )}
    </>
  );
}
