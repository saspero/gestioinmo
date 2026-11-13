'use client';

import * as React from 'react';

import {
  useBaixaConcepte,
  useConceptesContracte,
  useCrearConcepte,
  useModificarConcepte,
  type Concepte,
  type CrearConcepteInput,
} from '@/hooks/use-contractes';
import { ApiFetchError } from '@/hooks/api-client';
import { DataTable, EmptyState, FormField, LoadingSkeleton } from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { MESOS, TIPUS_CONCEPTE_OPTIONS, nomConcepte } from '@/features/contractes/types';

const avui = () => new Date().toLocaleDateString('en-CA');

const missatgeError = (err: unknown) =>
  err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat. Torna-ho a provar més tard.";

/** Com es cobra: cada mes, o una vegada l'any en un mes concret o repartida. */
export function textPeriodicitat(concepte: Pick<Concepte, 'periodicitat' | 'mesCobrament'>): string {
  if (concepte.periodicitat === 'mensual') return 'Mensual';
  return concepte.mesCobrament ? `Anual, al ${MESOS[concepte.mesCobrament - 1]}` : 'Anual, repartit en 12 mesos';
}

/** Estat d'una fila de l'historial respecte d'avui. */
export function estatConcepte(concepte: Pick<Concepte, 'vigentDesDe' | 'vigentFins'>, dia: string) {
  if (concepte.vigentDesDe > dia) return 'futur' as const;
  if (concepte.vigentFins && concepte.vigentFins < dia) return 'passat' as const;
  return 'vigent' as const;
}

interface ConceptesSectionProps {
  contracteId: string;
  canWrite: boolean;
  /** Data des de la qual es proposa cobrar una despesa nova. */
  dataInici: string;
}

/**
 * Renda i despeses repercutides del contracte. Cada canvi d'import queda a l'historial
 * amb la seva data d'efecte; per defecte només es veuen els imports vigents i futurs.
 */
export function ConceptesSection({ contracteId, canWrite, dataInici }: ConceptesSectionProps) {
  const { data: conceptes, isLoading } = useConceptesContracte(contracteId);
  const [historial, setHistorial] = React.useState(false);
  const [afegint, setAfegint] = React.useState(false);
  const [modificant, setModificant] = React.useState<Concepte | undefined>(undefined);
  const [donantBaixa, setDonantBaixa] = React.useState<Concepte | undefined>(undefined);

  const dia = avui();
  // Les files ja substituïdes per una altra no es poden tocar: només la més recent.
  const substituides = new Set((conceptes ?? []).map((c) => c.substitueixId).filter(Boolean));
  const visibles = (conceptes ?? []).filter((c) => historial || estatConcepte(c, dia) !== 'passat');

  const columns: ColumnDef<Concepte>[] = [
    { id: 'concepte', header: 'Concepte', cell: (row) => nomConcepte(row.tipus, row.descripcio) },
    { id: 'import', header: 'Import', cell: (row) => `${row.import} €`, className: 'text-right' },
    { id: 'periodicitat', header: 'Cobrament', cell: (row) => textPeriodicitat(row) },
    {
      id: 'vigencia',
      header: 'Vigència',
      cell: (row) => {
        const estat = estatConcepte(row, dia);
        const fins = row.vigentFins ? ` fins al ${row.vigentFins}` : '';
        if (estat === 'futur') return `A partir del ${row.vigentDesDe}${fins}`;
        return `Des del ${row.vigentDesDe}${fins}`;
      },
    },
    { id: 'motiu', header: 'Motiu', cell: (row) => row.motiu ?? '—' },
    {
      id: 'accions',
      header: '',
      cell: (row) =>
        canWrite && !substituides.has(row.id) && estatConcepte(row, dia) !== 'passat' ? (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModificant(row)}>
              Canviar import
            </Button>
            {row.tipus !== 'renda' && (
              <Button variant="outline" size="sm" onClick={() => setDonantBaixa(row)}>
                Deixar de cobrar
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Renda i despeses</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setHistorial((h) => !h)}>
            {historial ? 'Amagar historial' : 'Veure historial'}
          </Button>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => setAfegint(true)}>
              Afegir despesa
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton variant="table" columns={4} rows={2} />
      ) : visibles.length === 0 ? (
        <EmptyState title="Aquest contracte encara no té cap import." />
      ) : (
        <DataTable columns={columns} data={visibles} getRowId={(row) => row.id} />
      )}

      {canWrite && (
        <>
          <AfegirDespesaDialog
            contracteId={contracteId}
            open={afegint}
            onOpenChange={setAfegint}
            dataProposada={dataInici > dia ? dataInici : dia}
          />
          <ModificarImportDialog contracteId={contracteId} concepte={modificant} onClose={() => setModificant(undefined)} />
          <BaixaDespesaDialog contracteId={contracteId} concepte={donantBaixa} onClose={() => setDonantBaixa(undefined)} />
        </>
      )}
    </section>
  );
}

function ErrorForm({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  );
}

function AfegirDespesaDialog({
  contracteId,
  open,
  onOpenChange,
  dataProposada,
}: {
  contracteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataProposada: string;
}) {
  const crear = useCrearConcepte(contracteId);
  const [tipus, setTipus] = React.useState<CrearConcepteInput['tipus']>('escombraries');
  const [descripcio, setDescripcio] = React.useState('');
  const [importValor, setImportValor] = React.useState('');
  const [periodicitat, setPeriodicitat] = React.useState<'mensual' | 'anual'>('mensual');
  const [mesCobrament, setMesCobrament] = React.useState('');
  const [vigentDesDe, setVigentDesDe] = React.useState(dataProposada);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (open) setVigentDesDe(dataProposada);
  }, [open, dataProposada]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setErrors({});
    try {
      await crear.mutateAsync({
        tipus,
        descripcio: descripcio || undefined,
        import: Number(importValor),
        periodicitat,
        mesCobrament: periodicitat === 'anual' && mesCobrament ? Number(mesCobrament) : undefined,
        vigentDesDe,
      });
      toast({ title: 'Despesa afegida' });
      setDescripcio('');
      setImportValor('');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiFetchError) setErrors(err.fields ?? {});
      setError(missatgeError(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Afegir despesa repercutida</DialogTitle>
            <DialogDescription>Un import que paga l&apos;inquilí a més de la renda.</DialogDescription>
          </DialogHeader>
          <ErrorForm error={error} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Despesa" required error={errors.tipus}>
              <Select value={tipus} onChange={(event) => setTipus(event.target.value as CrearConcepteInput['tipus'])}>
                {TIPUS_CONCEPTE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Descripció" required={tipus === 'altres'} error={errors.descripcio}>
              <Input value={descripcio} onChange={(event) => setDescripcio(event.target.value)} />
            </FormField>
            <FormField label="Import (€)" required error={errors.import}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={importValor}
                onChange={(event) => setImportValor(event.target.value)}
              />
            </FormField>
            <FormField label="Es cobra" error={errors.periodicitat}>
              <Select
                value={periodicitat}
                onChange={(event) => setPeriodicitat(event.target.value as 'mensual' | 'anual')}
              >
                <option value="mensual">Cada mes</option>
                <option value="anual">Un cop l&apos;any</option>
              </Select>
            </FormField>
            {periodicitat === 'anual' && (
              <FormField
                label="Mes de cobrament"
                description="Si no en tries cap, es reparteix en 12 mesos."
                error={errors.mesCobrament}
              >
                <Select value={mesCobrament} onChange={(event) => setMesCobrament(event.target.value)}>
                  <option value="">Repartit en 12 mesos</option>
                  {MESOS.map((mes, index) => (
                    <option key={mes} value={index + 1}>
                      {mes}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField label="Es cobra a partir del" required error={errors.vigentDesDe}>
              <Input type="date" value={vigentDesDe} onChange={(event) => setVigentDesDe(event.target.value)} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" loading={crear.isPending}>
              Afegir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModificarImportDialog({
  contracteId,
  concepte,
  onClose,
}: {
  contracteId: string;
  concepte: Concepte | undefined;
  onClose: () => void;
}) {
  const modificar = useModificarConcepte(contracteId);
  const [importValor, setImportValor] = React.useState('');
  const [dataEfecte, setDataEfecte] = React.useState('');
  const [motiu, setMotiu] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (concepte) {
      setImportValor(concepte.import);
      setDataEfecte(avui());
      setMotiu('');
      setErrors({});
      setError(undefined);
    }
  }, [concepte]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!concepte) return;
    setError(undefined);
    setErrors({});
    try {
      await modificar.mutateAsync({
        concepteId: concepte.id,
        import: Number(importValor),
        dataEfecte,
        motiu: motiu || undefined,
      });
      toast({ title: 'Import canviat', description: `S'aplica a partir del ${dataEfecte}.` });
      onClose();
    } catch (err) {
      if (err instanceof ApiFetchError) setErrors(err.fields ?? {});
      setError(missatgeError(err));
    }
  }

  const nom = concepte ? nomConcepte(concepte.tipus, concepte.descripcio) : '';

  return (
    <Dialog open={concepte !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Canviar l&apos;import: {nom}</DialogTitle>
            <DialogDescription>
              L&apos;import actual ({concepte?.import} €) es manté fins al dia abans de la data d&apos;efecte i queda a
              l&apos;historial.
            </DialogDescription>
          </DialogHeader>
          <ErrorForm error={error} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Import nou (€)" required error={errors.import}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={importValor}
                onChange={(event) => setImportValor(event.target.value)}
              />
            </FormField>
            <FormField label="A partir del" required error={errors.dataEfecte}>
              <Input type="date" value={dataEfecte} onChange={(event) => setDataEfecte(event.target.value)} />
            </FormField>
          </div>
          <FormField label="Motiu" description="Opcional. Per exemple: actualització IPC 2,8 %." error={errors.motiu}>
            <Input value={motiu} onChange={(event) => setMotiu(event.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel·lar
            </Button>
            <Button type="submit" loading={modificar.isPending}>
              Desar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BaixaDespesaDialog({
  contracteId,
  concepte,
  onClose,
}: {
  contracteId: string;
  concepte: Concepte | undefined;
  onClose: () => void;
}) {
  const baixa = useBaixaConcepte(contracteId);
  const [dataEfecte, setDataEfecte] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (concepte) {
      setDataEfecte(avui());
      setError(undefined);
    }
  }, [concepte]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!concepte) return;
    setError(undefined);
    try {
      await baixa.mutateAsync({ concepteId: concepte.id, dataEfecte });
      toast({ title: 'Despesa donada de baixa' });
      onClose();
    } catch (err) {
      setError(missatgeError(err));
    }
  }

  const nom = concepte ? nomConcepte(concepte.tipus, concepte.descripcio) : '';

  return (
    <Dialog open={concepte !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Deixar de cobrar: {nom}</DialogTitle>
            <DialogDescription>
              Es cobrarà fins al dia abans de la data indicada i quedarà a l&apos;historial.
            </DialogDescription>
          </DialogHeader>
          <ErrorForm error={error} />
          <FormField label="Es deixa de cobrar a partir del" required>
            <Input type="date" value={dataEfecte} onChange={(event) => setDataEfecte(event.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel·lar
            </Button>
            <Button type="submit" variant="destructive" loading={baixa.isPending}>
              Deixar de cobrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
