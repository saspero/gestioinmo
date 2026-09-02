'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/hooks/api-client';
import { useListPropietats } from '@/hooks/use-propietats';
import { FormField } from '@/components/shared';
import { Select } from '@/components/ui/select';
import type { UnitatOpcio } from '@/features/incidencies/types';

interface UnitatPickerProps {
  propietatId: string;
  onPropietatChange: (id: string) => void;
  unitatId: string;
  onUnitatChange: (id: string) => void;
  error?: string;
}

/** Selector propietat → unitat, compartit per la creació d'incidències. No hi ha
 *  `useListUnitats` a `src/hooks/`: es consulta amb `apiFetch` (mateixa clau de caché que
 *  `src/features/propietats/components/unitats-section.tsx`). A diferència del wizard de
 *  contractes, aquí es mostren totes les unitats (una incidència es pot reportar
 *  independentment del seu estat d'ocupació). */
export function UnitatPicker({ propietatId, onPropietatChange, unitatId, onUnitatChange, error }: UnitatPickerProps) {
  const { data: propietats } = useListPropietats({ pageSize: 100 });
  const { data: unitats, isLoading } = useQuery({
    queryKey: ['propietats', propietatId, 'unitats'],
    queryFn: () => apiFetch<UnitatOpcio[]>(`/api/propietats/${propietatId}/unitats`).then((res) => res.data),
    enabled: !!propietatId,
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Propietat" required>
        <Select value={propietatId} onChange={(event) => onPropietatChange(event.target.value)}>
          <option value="">Selecciona una propietat…</option>
          {(propietats?.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.referencia}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Unitat" required error={error}>
        <Select value={unitatId} onChange={(event) => onUnitatChange(event.target.value)} disabled={!propietatId}>
          <option value="">{isLoading ? 'Carregant…' : 'Selecciona una unitat…'}</option>
          {(unitats ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.referencia}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}
