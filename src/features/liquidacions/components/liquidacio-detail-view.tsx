'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  useEsborrarLiquidacio,
  useLiquidacio,
  usePagarLiquidacio,
  type LiniaLiquidacio,
} from '@/hooks/use-liquidacions';
import { ApiFetchError } from '@/hooks/api-client';
import { ConfirmDialog, ErrorState, FormField, LoadingSkeleton } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
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
import { avuiLocal } from '@/lib/validations/contractes';
import { IVA_COMISSIO } from '@/lib/validations/liquidacions';

function missatge(err: unknown): string {
  return err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.";
}

const percent = (valor: string) => `${Number(valor).toLocaleString('ca-ES')} %`;

export function LiquidacioDetailView({ id, canWrite }: { id: string; canWrite: boolean }) {
  const router = useRouter();
  const { data: liquidacio, isLoading, isError, refetch } = useLiquidacio(id);
  const esborrar = useEsborrarLiquidacio();
  const [pagarOpen, setPagarOpen] = React.useState(false);
  const [esborrarOpen, setEsborrarOpen] = React.useState(false);

  if (isLoading) return <LoadingSkeleton variant="detail" sections={2} />;
  if (isError || !liquidacio) return <ErrorState onRetry={() => refetch()} />;

  const linies = liquidacio.linies ?? [];
  const cobraments = linies.filter((l) => l.tipus === 'cobrament');
  const despeses = linies.filter((l) => l.tipus === 'despesa');

  async function handleEsborrar() {
    try {
      await esborrar.mutateAsync(id);
      toast({ title: 'Liquidació esborrada', description: 'El que contenia torna a quedar per liquidar.' });
      router.push('/pagaments/liquidacions');
    } catch (err) {
      setEsborrarOpen(false);
      toast({ variant: 'destructive', title: "No s'ha pogut esborrar", description: missatge(err) });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Propietari" value={liquidacio.propietariNom} />
          <Field label="Període" value={`${liquidacio.periodeInici} — ${liquidacio.periodeFi}`} />
          <Field label="Estat" value={liquidacio.dataPagament ? `Pagada el ${liquidacio.dataPagament}` : 'Pendent de pagar'} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <table className="w-full max-w-md text-sm">
            <tbody>
              <Fila label="Total cobrat" valor={liquidacio.totalCobrat} />
              <Fila label="Despeses" valor={liquidacio.totalDespeses} negatiu />
              <Fila label="Comissió de l'agència" valor={liquidacio.comissioAgencia} negatiu />
              <Fila label={`IVA de la comissió (${IVA_COMISSIO} %)`} valor={liquidacio.ivaComissio} negatiu />
              <tr className="border-t border-border">
                <td className="pt-3 pr-4 font-semibold">Net a pagar al propietari</td>
                <td className="pt-3 text-right font-semibold tabular-nums">{liquidacio.netALiquidar} €</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Taula
        titol="Rebuts cobrats"
        buit="Cap rebut cobrat en aquest període."
        linies={cobraments}
        ambComissio
      />
      <Taula titol="Despeses a càrrec del propietari" buit="Cap despesa en aquest període." linies={despeses} />

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.print()}>
          Imprimir
        </Button>
        {canWrite && !liquidacio.dataPagament && (
          <>
            <Button onClick={() => setPagarOpen(true)}>Marcar com a pagada</Button>
            <Button variant="destructive" onClick={() => setEsborrarOpen(true)}>
              Esborrar
            </Button>
          </>
        )}
      </div>

      {pagarOpen && <PagarDialog id={id} onClose={() => setPagarOpen(false)} />}
      <ConfirmDialog
        open={esborrarOpen}
        onOpenChange={setEsborrarOpen}
        title="Esborrar liquidació"
        description="Els rebuts i les despeses que conté tornaran a quedar per liquidar. Queda registrat a l'auditoria."
        destructive
        loading={esborrar.isPending}
        onConfirm={handleEsborrar}
      />
    </div>
  );
}

function Fila({ label, valor, negatiu }: { label: string; valor: string; negatiu?: boolean }) {
  return (
    <tr>
      <td className="py-1 pr-4">{label}</td>
      <td className="py-1 text-right tabular-nums">
        {negatiu && Number(valor) !== 0 ? '−' : ''}
        {valor} €
      </td>
    </tr>
  );
}

function Taula({
  titol,
  buit,
  linies,
  ambComissio,
}: {
  titol: string;
  buit: string;
  linies: LiniaLiquidacio[];
  ambComissio?: boolean;
}) {
  const copropietat = linies.some((l) => Number(l.percentatge) !== 100);
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{titol}</h2>
        {linies.length === 0 ? (
          <p className="text-sm text-muted-foreground">{buit}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 pr-4 font-medium">Concepte</th>
                  {copropietat && <th className="py-2 pr-4 text-right font-medium">Import sencer</th>}
                  {copropietat && <th className="py-2 pr-4 text-right font-medium">Part</th>}
                  <th className="py-2 pr-4 text-right font-medium">Import</th>
                  {ambComissio && <th className="py-2 text-right font-medium">Comissió</th>}
                </tr>
              </thead>
              <tbody>
                {linies.map((linia) => (
                  <tr key={linia.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{linia.data}</td>
                    <td className="py-2 pr-4">{linia.descripcio}</td>
                    {copropietat && <td className="py-2 pr-4 text-right tabular-nums">{linia.importTotal} €</td>}
                    {copropietat && <td className="py-2 pr-4 text-right">{percent(linia.percentatge)}</td>}
                    <td className="py-2 pr-4 text-right tabular-nums">{linia.import} €</td>
                    {ambComissio && <td className="py-2 text-right tabular-nums">{linia.comissio} €</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PagarDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const pagar = usePagarLiquidacio(id);
  const [data, setData] = React.useState(avuiLocal());
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      await pagar.mutateAsync(data);
      toast({ title: 'Liquidació marcada com a pagada' });
      onClose();
    } catch (err) {
      setError(missatge(err));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Marcar com a pagada</DialogTitle>
            <DialogDescription>
              Un cop pagada, la liquidació ja no es pot esborrar.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <FormField label="Data del pagament" required>
            <Input type="date" value={data} onChange={(event) => setData(event.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel·lar
            </Button>
            <Button type="submit" loading={pagar.isPending} disabled={!data}>
              Marcar com a pagada
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
