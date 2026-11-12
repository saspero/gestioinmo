'use client';

import * as React from 'react';
import { usePropietat } from '@/hooks/use-propietats';
import { LoadingSkeleton, ErrorState } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TIPUS_PROPIETAT_OPTIONS, TIPUS_SOL_OPTIONS } from '@/features/propietats/types';
import { CAMPS_PER_TIPUS, type CampPerTipus, type TipusPropietat } from '@/lib/validations/propietats';
import { UnitatsSection } from '@/features/propietats/components/unitats-section';
import { TitularsSection } from '@/features/propietats/components/titulars-section';
import { PropietatForm } from '@/features/propietats/components/propietat-form';

interface PropietatDetailViewProps {
  id: string;
  canWrite: boolean;
}

export function PropietatDetailView({ id, canWrite }: PropietatDetailViewProps) {
  const { data: propietat, isLoading, isError, refetch } = usePropietat(id);
  const [editant, setEditant] = React.useState(false);

  if (isLoading) {
    return <LoadingSkeleton variant="detail" sections={2} />;
  }

  if (isError || !propietat) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (editant) {
    return <PropietatForm propietat={propietat} onClose={() => setEditant(false)} />;
  }

  const tipusLabel = TIPUS_PROPIETAT_OPTIONS.find((o) => o.value === propietat.tipus)?.label ?? propietat.tipus;
  const tipusSolLabel = TIPUS_SOL_OPTIONS.find((o) => o.value === propietat.tipusSol)?.label;
  // Camps del tipus d'aquesta propietat; un tipus desconegut els mostra tots.
  const propis = CAMPS_PER_TIPUS[propietat.tipus as TipusPropietat] as readonly CampPerTipus[] | undefined;
  const te = (camp: CampPerTipus) => !propis || propis.includes(camp);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipus" value={tipusLabel} />
          <Field label="Adreça" value={propietat.adreca} />
          <Field label="Població" value={propietat.poblacio ?? '—'} />
          <Field label="Codi postal" value={propietat.cp ?? '—'} />
          <Field label="Referència cadastral" value={propietat.referenciaCadastral ?? '—'} />
          {te('superficie') && (
            <Field
              label={propietat.tipus === 'solar' ? 'Superfície del solar' : 'Superfície'}
              value={propietat.superficie ? `${propietat.superficie} m²` : '—'}
            />
          )}
          {te('superficieEdificable') && (
            <Field
              label="Superfície edificable"
              value={propietat.superficieEdificable ? `${propietat.superficieEdificable} m²` : '—'}
            />
          )}
          {te('tipusSol') && <Field label="Tipus de sòl" value={tipusSolLabel ?? '—'} />}
          {te('habitacions') && <Field label="Habitacions" value={propietat.habitacions ?? '—'} />}
          {te('banys') && <Field label="Banys" value={propietat.banys ?? '—'} />}
          {te('numPisos') && <Field label="Nombre de pisos" value={propietat.numPisos ?? '—'} />}
          {te('numeroPlaca') && <Field label="Número de plaça" value={propietat.numeroPlaca ?? '—'} />}
          {te('planta') && <Field label="Planta" value={propietat.planta ?? '—'} />}
          {te('ascensor') && <Field label="Ascensor" value={propietat.ascensor ? 'Sí' : 'No'} />}
          {te('certEnergetic') && <Field label="Certificat energètic" value={propietat.certEnergetic ?? '—'} />}
          {propietat.notes && <Field label="Notes" value={propietat.notes} className="sm:col-span-2 lg:col-span-3" />}
        </CardContent>
      </Card>

      {canWrite && (
        <div>
          <Button variant="outline" onClick={() => setEditant(true)}>
            Editar
          </Button>
        </div>
      )}

      <TitularsSection propietatId={id} canWrite={canWrite} />
      <UnitatsSection propietatId={id} canWrite={canWrite} />
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
