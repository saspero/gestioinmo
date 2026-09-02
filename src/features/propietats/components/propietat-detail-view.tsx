'use client';

import type { ReactNode } from 'react';
import { usePropietat } from '@/hooks/use-propietats';
import { LoadingSkeleton, ErrorState } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { TIPUS_PROPIETAT_OPTIONS } from '@/features/propietats/types';
import { UnitatsSection } from '@/features/propietats/components/unitats-section';

interface PropietatDetailViewProps {
  id: string;
  canWrite: boolean;
}

export function PropietatDetailView({ id, canWrite }: PropietatDetailViewProps) {
  const { data: propietat, isLoading, isError, refetch } = usePropietat(id);

  if (isLoading) {
    return <LoadingSkeleton variant="detail" sections={2} />;
  }

  if (isError || !propietat) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const tipusLabel = TIPUS_PROPIETAT_OPTIONS.find((o) => o.value === propietat.tipus)?.label ?? propietat.tipus;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tipus" value={tipusLabel} />
          <Field label="Adreça" value={propietat.adreca} />
          <Field label="Població" value={propietat.poblacio ?? '—'} />
          <Field label="Codi postal" value={propietat.cp ?? '—'} />
          <Field label="Superfície" value={propietat.superficie ? `${propietat.superficie} m²` : '—'} />
          <Field label="Habitacions" value={propietat.habitacions ?? '—'} />
          <Field label="Banys" value={propietat.banys ?? '—'} />
          <Field label="Ascensor" value={propietat.ascensor ? 'Sí' : 'No'} />
          <Field label="Certificat energètic" value={propietat.certEnergetic ?? '—'} />
          {propietat.notes && <Field label="Notes" value={propietat.notes} className="sm:col-span-2 lg:col-span-3" />}
        </CardContent>
      </Card>

      <UnitatsSection propietatId={id} canWrite={canWrite} />
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
