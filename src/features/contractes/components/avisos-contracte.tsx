'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, TrendingUp } from 'lucide-react';

import {
  useAvisosContractes,
  useConceptesContracte,
  useContracte,
  useModificarConcepte,
  type Contracte,
} from '@/hooks/use-contractes';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import {
  avisosContracte,
  avuiLocal,
  rendaActualitzada,
  type AvisContracte,
} from '@/lib/validations/contractes';

type AvisActualitzacio = Extract<AvisContracte, { tipus: 'actualitzacio' }>;

const NOM_INDEX: Record<string, string> = { ipc: 'IPC', irav: 'IRAV', percentatge_fix: 'pactada' };

function euros(valor: number): string {
  return `${valor.toFixed(2)} €`;
}

function TextAvis({ avis, avui }: { avis: AvisContracte; avui: string }) {
  if (avis.tipus === 'actualitzacio') {
    const quan = avis.aniversari < avui ? `va fer anys el ${avis.aniversari}` : `fa anys el ${avis.aniversari}`;
    return (
      <>
        <strong>Actualització de la renda:</strong> el contracte {quan}.{' '}
        {avis.rendaProposada !== null
          ? `Renda actual ${euros(avis.rendaActual)}; amb el ${avis.percentatge} % pactat passa a ${euros(avis.rendaProposada)}.`
          : `Renda actual ${euros(avis.rendaActual)}. Cal consultar l'índex del moment.`}{' '}
        Recorda comunicar-ho per escrit a l&apos;inquilí: s&apos;aplica a partir del mes següent a la comunicació.
      </>
    );
  }
  const preavis = avis.preavisPerDefecte
    ? `${avis.preavisDies} dies, el preavís legal del propietari (el contracte no en té cap de pactat)`
    : `${avis.preavisDies} dies de preavís pactat`;
  const final = avis.prorrogaAutomatica
    ? `Si ningú ho comunica, es prorroga automàticament quan acabi el període, el ${avis.venciment}.`
    : `El contracte acaba el ${avis.venciment}.`;
  return (
    <>
      <strong>{avis.limit < avui ? 'Termini per no renovar passat' : 'Termini per no renovar'}:</strong>{' '}
      {avis.limit < avui
        ? `el límit per comunicar-ho era el ${avis.limit} (${preavis}).`
        : `si no es vol renovar, cal comunicar-ho com a molt tard el ${avis.limit} (${preavis}).`}{' '}
      {final}
    </>
  );
}

function AvisFila({
  avis,
  contracteId,
  canWrite,
  avui,
}: {
  avis: AvisContracte;
  contracteId: string;
  canWrite: boolean;
  avui: string;
}) {
  const [obert, setObert] = React.useState(false);
  const Icona = avis.tipus === 'actualitzacio' ? TrendingUp : AlertTriangle;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <p className="flex gap-2 text-sm">
        <Icona className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <span>
          <TextAvis avis={avis} avui={avui} />
        </span>
      </p>
      {canWrite && avis.tipus === 'actualitzacio' && (
        <>
          <Button size="sm" className="shrink-0" onClick={() => setObert(true)}>
            Actualitzar renda
          </Button>
          {obert && <ActualitzarRendaDialog contracteId={contracteId} avis={avis} onClose={() => setObert(false)} />}
        </>
      )}
    </div>
  );
}

/** Tots els avisos dels contractes actius, a la pàgina de Contractes. */
export function AvisosContractesCard({ canWrite }: { canWrite: boolean }) {
  const { data } = useAvisosContractes();
  if (!data || data.length === 0) return null;
  const avui = avuiLocal();

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Avisos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.map((fila) => (
          <div key={fila.contracteId} className="flex flex-col gap-2">
            <Link href={`/contractes/${fila.contracteId}`} className="text-sm font-medium text-primary hover:underline">
              {fila.nom || 'Contracte'}
            </Link>
            {fila.avisos.map((avis) => (
              <AvisFila key={avis.tipus} avis={avis} contracteId={fila.contracteId} canWrite={canWrite} avui={avui} />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Avisos d'un sol contracte, a la seva fitxa. */
export function AvisosContracte({ contracte, canWrite }: { contracte: Contracte; canWrite: boolean }) {
  const avui = avuiLocal();
  const avisos = avisosContracte(contracte, avui);
  if (avisos.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      {avisos.map((avis) => (
        <AvisFila key={avis.tipus} avis={avis} contracteId={contracte.id} canWrite={canWrite} avui={avui} />
      ))}
    </div>
  );
}

function ActualitzarRendaDialog({
  contracteId,
  avis,
  onClose,
}: {
  contracteId: string;
  avis: AvisActualitzacio;
  onClose: () => void;
}) {
  const { data: conceptes } = useConceptesContracte(contracteId);
  const { data: contracte } = useContracte(contracteId);
  const modificar = useModificarConcepte(contracteId);
  const [percentatge, setPercentatge] = React.useState(avis.percentatge !== null ? String(avis.percentatge) : '');
  const [renda, setRenda] = React.useState(avis.rendaProposada !== null ? avis.rendaProposada.toFixed(2) : '');
  const [dataEfecte, setDataEfecte] = React.useState(avis.aniversari);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | undefined>(undefined);

  // La fila de renda que es pot canviar és la més recent (sense data de fi).
  const rendaOberta = conceptes?.find((c) => c.tipus === 'renda' && c.vigentFins === null);
  const index = NOM_INDEX[contracte?.tipusActualitzacio ?? ''] ?? '';

  function canviarPercentatge(valor: string) {
    setPercentatge(valor);
    const numero = Number(valor.replace(',', '.'));
    if (valor !== '' && Number.isFinite(numero)) setRenda(rendaActualitzada(avis.rendaActual, numero).toFixed(2));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rendaOberta) return;
    setError(undefined);
    setErrors({});
    const parts = ['Actualització', index, percentatge ? `${percentatge.replace('.', ',')} %` : ''];
    try {
      await modificar.mutateAsync({
        concepteId: rendaOberta.id,
        import: Number(renda),
        dataEfecte,
        motiu: parts.filter(Boolean).join(' '),
      });
      toast({ title: 'Renda actualitzada', description: `${renda} € a partir del ${dataEfecte}.` });
      onClose();
    } catch (err) {
      if (err instanceof ApiFetchError) setErrors(err.fields ?? {});
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Actualitzar la renda</DialogTitle>
            <DialogDescription>
              Renda actual: {euros(avis.rendaActual)}. La renda nova s&apos;aplica a partir de la data que triïs i
              l&apos;actual queda a l&apos;historial.
              {avis.percentatge === null &&
                " Consulta la variació de l'índex a l'INE (ine.es) per al mes de referència del contracte."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Percentatge (%)">
              <Input
                type="number"
                step="0.01"
                value={percentatge}
                onChange={(event) => canviarPercentatge(event.target.value)}
              />
            </FormField>
            <FormField label="Renda nova (€)" required error={errors.import}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={renda}
                onChange={(event) => setRenda(event.target.value)}
              />
            </FormField>
            <FormField label="A partir del" required error={errors.dataEfecte}>
              <Input type="date" value={dataEfecte} onChange={(event) => setDataEfecte(event.target.value)} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel·lar
            </Button>
            <Button type="submit" loading={modificar.isPending} disabled={!rendaOberta || !renda || !dataEfecte}>
              Aplicar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
