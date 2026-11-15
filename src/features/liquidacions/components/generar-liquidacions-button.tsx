'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useGenerarLiquidacions } from '@/hooks/use-liquidacions';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { avuiLocal, sumarDies } from '@/lib/validations/contractes';

/** Per defecte, el mes passat sencer. */
function mesPassat(): { inici: string; fi: string } {
  const primerDelMes = `${avuiLocal().slice(0, 7)}-01`;
  const fi = sumarDies(primerDelMes, -1);
  return { inici: `${fi.slice(0, 7)}-01`, fi };
}

export function GenerarLiquidacionsButton() {
  const router = useRouter();
  const generar = useGenerarLiquidacions();
  const [open, setOpen] = React.useState(false);
  const [inici, setInici] = React.useState('');
  const [fi, setFi] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | undefined>(undefined);

  function obrir() {
    const periode = mesPassat();
    setInici(periode.inici);
    setFi(periode.fi);
    setErrors({});
    setError(undefined);
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setErrors({});
    try {
      const creades = await generar.mutateAsync({ periodeInici: inici, periodeFi: fi });
      setOpen(false);
      if (creades.length === 0) {
        toast({
          title: 'No hi ha res per liquidar',
          description: 'Cap rebut cobrat ni despesa del propietari en aquest període que no estigui ja liquidat.',
        });
      } else if (creades.length === 1) {
        toast({ title: 'Liquidació creada' });
        router.push(`/pagaments/liquidacions/${creades[0].id}`);
      } else {
        toast({ title: `S'han creat ${creades.length} liquidacions`, description: 'Una per propietari.' });
      }
    } catch (err) {
      if (err instanceof ApiFetchError) setErrors(err.fields ?? {});
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <>
      <Button onClick={obrir}>Generar liquidacions</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Generar liquidacions</DialogTitle>
              <DialogDescription>
                Es crea una liquidació per a cada propietari amb rebuts cobrats o despeses a càrrec seu dins del
                període. El que ja s&apos;ha liquidat abans no es torna a incloure.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Des del" required error={errors.periodeInici}>
                <Input type="date" value={inici} onChange={(event) => setInici(event.target.value)} />
              </FormField>
              <FormField label="Fins al" required error={errors.periodeFi}>
                <Input type="date" value={fi} onChange={(event) => setFi(event.target.value)} />
              </FormField>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel·lar
              </Button>
              <Button type="submit" loading={generar.isPending} disabled={!inici || !fi}>
                Generar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
