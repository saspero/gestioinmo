'use client';

import * as React from 'react';

import {
  descarregarDocument,
  useEsborrarDocument,
  useListDocuments,
  usePujarDocument,
  type Document,
} from '@/hooks/use-documents';
import { ApiFetchError } from '@/hooks/api-client';
import { ConfirmDialog, DataTable, EmptyState, LoadingSkeleton } from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { TIPUS_DOCUMENT_PERMESOS, type EntitatDocument } from '@/lib/validations/documents';

const ACCEPT = Object.entries(TIPUS_DOCUMENT_PERMESOS)
  .flatMap(([mime, extensions]) => [mime, ...extensions.map((extensio) => `.${extensio}`)])
  .join(',');

export function formatMida(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

const formatData = (iso: string) =>
  new Date(iso).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

interface DocumentsSectionProps {
  entitat: EntitatDocument;
  entitatId: string;
  canWrite: boolean;
}

/** Documents adjunts d'una fitxa: llistat, pujada (fins a 10 MB), descàrrega i esborrat. */
export function DocumentsSection({ entitat, entitatId, canWrite }: DocumentsSectionProps) {
  const { data: documents, isLoading } = useListDocuments(entitat, entitatId);
  const pujar = usePujarDocument(entitat, entitatId);
  const esborrar = useEsborrarDocument(entitat, entitatId);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [descarregant, setDescarregant] = React.useState<string | undefined>(undefined);
  const [perEsborrar, setPerEsborrar] = React.useState<Document | undefined>(undefined);

  const missatgeError = (err: unknown) =>
    err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat. Torna-ho a provar més tard.";

  async function handleFitxer(event: React.ChangeEvent<HTMLInputElement>) {
    const fitxer = event.target.files?.[0];
    event.target.value = '';
    if (!fitxer) return;
    try {
      await pujar.mutateAsync(fitxer);
      toast({ title: 'Document pujat', description: `S'ha adjuntat "${fitxer.name}".` });
    } catch (err) {
      toast({ title: "No s'ha pogut pujar el document", description: missatgeError(err), variant: 'destructive' });
    }
  }

  async function handleDescarregar(document: Document) {
    setDescarregant(document.id);
    try {
      await descarregarDocument(document);
    } catch (err) {
      toast({ title: "No s'ha pogut descarregar", description: missatgeError(err), variant: 'destructive' });
    } finally {
      setDescarregant(undefined);
    }
  }

  async function handleEsborrar() {
    if (!perEsborrar) return;
    try {
      await esborrar.mutateAsync(perEsborrar.id);
      toast({ title: 'Document esborrat' });
      setPerEsborrar(undefined);
    } catch (err) {
      toast({ title: "No s'ha pogut esborrar", description: missatgeError(err), variant: 'destructive' });
    }
  }

  const columns: ColumnDef<Document>[] = [
    { id: 'nom', header: 'Document', cell: (row) => <span className="break-all">{row.nom}</span> },
    { id: 'mida', header: 'Mida', cell: (row) => formatMida(row.mida) },
    { id: 'data', header: 'Pujat el', cell: (row) => formatData(row.createdAt) },
    { id: 'pujatPer', header: 'Per', cell: (row) => row.pujatPer ?? '—' },
    {
      id: 'accions',
      header: '',
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={descarregant === row.id}
            onClick={() => handleDescarregar(row)}
          >
            Descarregar
          </Button>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => setPerEsborrar(row)}>
              Esborrar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Documents</h2>
        {canWrite && (
          <>
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFitxer} />
            <Button variant="outline" size="sm" loading={pujar.isPending} onClick={() => inputRef.current?.click()}>
              {pujar.isPending ? 'Pujant…' : 'Adjuntar document'}
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="table" columns={4} rows={2} />
      ) : !documents || documents.length === 0 ? (
        <EmptyState
          title="Encara no hi ha cap document adjunt."
          description={canWrite ? 'PDF, imatges, Word o Excel, fins a 10 MB cadascun.' : undefined}
        />
      ) : (
        <DataTable columns={columns} data={documents} getRowId={(row) => row.id} />
      )}

      <ConfirmDialog
        open={perEsborrar !== undefined}
        onOpenChange={(open) => !open && setPerEsborrar(undefined)}
        title="Esborrar el document"
        description={`S'esborrarà "${perEsborrar?.nom ?? ''}" definitivament. No es podrà recuperar.`}
        destructive
        loading={esborrar.isPending}
        onConfirm={handleEsborrar}
      />
    </section>
  );
}
