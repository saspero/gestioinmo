'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  useDeletePropietari,
  usePropietari,
  usePropietatsDePropietari,
  type PropietatDePropietari,
} from '@/hooks/use-propietaris';
import { ApiFetchError } from '@/hooks/api-client';
import { ConfirmDialog, DataTable, EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { AssociarPropietat } from './associar-propietat';
import { EditarPropietariForm } from './propietari-form';
import { descripcioRepresentant } from '@/features/persones/components/dades-identificacio';
import { DocumentsSection } from '@/features/documents/components/documents-section';

const COLUMNES_PROPIETATS: ColumnDef<PropietatDePropietari>[] = [
  { id: 'referencia', header: 'Referència', cell: (row) => row.referencia },
  { id: 'adreca', header: 'Adreça', cell: (row) => row.adreca },
  { id: 'percentatge', header: 'Titularitat', cell: (row) => `${row.percentatge}%` },
];

interface PropietariDetailViewProps {
  id: string;
  canWrite: boolean;
}

export function PropietariDetailView({ id, canWrite }: PropietariDetailViewProps) {
  const router = useRouter();
  const { data: propietari, isLoading, isError, refetch } = usePropietari(id);
  const { data: propietats, isLoading: propietatsLoading } = usePropietatsDePropietari(id);
  const deletePropietari = useDeletePropietari();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [editant, setEditant] = React.useState(false);
  const [associant, setAssociant] = React.useState(false);

  if (isLoading) {
    return <LoadingSkeleton variant="detail" sections={2} />;
  }

  if (isError || !propietari) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const nomComplet = `${propietari.nom} ${propietari.cognoms ?? ''}`.trim();

  async function handleDelete() {
    try {
      await deletePropietari.mutateAsync(id);
      toast({ title: 'Propietari donat de baixa' });
      router.push('/propietaris');
    } catch (error) {
      setConfirmOpen(false);
      toast({
        variant: 'destructive',
        title: "No s'ha pogut donar de baixa",
        description:
          error instanceof ApiFetchError ? error.message : "S'ha produït un error inesperat. Torna-ho a provar més tard.",
      });
    }
  }

  if (editant) {
    return <EditarPropietariForm propietari={propietari} onClose={() => setEditant(false)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={propietari.personaJuridica ? 'Raó social' : 'Nom'} value={nomComplet} />
          <Field label={propietari.personaJuridica ? 'CIF' : 'DNI/NIE'} value={propietari.nif ?? '—'} />
          {propietari.personaJuridica && (
            <Field label="Representant legal" value={descripcioRepresentant(propietari)} />
          )}
          <Field label="Email" value={propietari.email ?? '—'} />
          <Field label="Telèfon" value={propietari.telefon ?? '—'} />
          <Field label="IBAN" value={propietari.iban ?? '—'} />
          <Field label="Adreça" value={propietari.adreca ?? '—'} />
          {propietari.notes && <Field label="Notes" value={propietari.notes} className="sm:col-span-2 lg:col-span-3" />}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Propietats</h2>
          {canWrite && !associant && (
            <Button variant="outline" size="sm" onClick={() => setAssociant(true)}>
              Associar propietat
            </Button>
          )}
        </div>
        {associant && (
          <AssociarPropietat propietariId={id} propietariNom={nomComplet} onClose={() => setAssociant(false)} />
        )}
        {propietatsLoading ? (
          <LoadingSkeleton variant="table" columns={3} rows={3} />
        ) : !propietats || propietats.length === 0 ? (
          <EmptyState title="Aquest propietari encara no té cap propietat associada." />
        ) : (
          <DataTable
            columns={COLUMNES_PROPIETATS}
            data={propietats}
            getRowId={(row) => row.propietatId}
            onRowClick={(row) => router.push(`/propietats/${row.propietatId}`)}
          />
        )}
      </section>

      <DocumentsSection entitat="persona" entitatId={id} canWrite={canWrite} />

      {canWrite && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditant(true)}>
            Editar
          </Button>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Donar de baixa
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Donar de baixa el propietari"
            description={`Es donarà de baixa a "${nomComplet}". Si té propietats associades, l'operació es rebutjarà.`}
            destructive
            loading={deletePropietari.isPending}
            onConfirm={handleDelete}
          />
        </div>
      )}
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
