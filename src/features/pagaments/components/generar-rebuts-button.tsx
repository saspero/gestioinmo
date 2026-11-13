'use client';

import * as React from 'react';

import { useGenerarRebuts } from '@/hooks/use-pagaments';
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

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

function textResultat(creats: number, jaExistien: number): string {
  const nous = creats === 1 ? "S'ha creat 1 rebut." : `S'han creat ${creats} rebuts.`;
  if (jaExistien === 0) return nous;
  const vells = jaExistien === 1 ? '1 contracte ja el tenia.' : `${jaExistien} contractes ja el tenien.`;
  return `${nous} ${vells}`;
}

export function GenerarRebutsButton() {
  const generar = useGenerarRebuts();
  const [open, setOpen] = React.useState(false);
  const [periode, setPeriode] = React.useState(mesActual);
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const resultat = await generar.mutateAsync(periode);
      toast({ title: 'Rebuts generats', description: textResultat(resultat.creats, resultat.jaExistien) });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          setPeriode(mesActual());
          setError(undefined);
          setOpen(true);
        }}
      >
        Generar rebuts del mes
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <DialogHeader>
              <DialogTitle>Generar rebuts del mes</DialogTitle>
              <DialogDescription>
                Es crea un rebut per a cada contracte actiu, amb una línia per la renda i per cada despesa
                que paga l&apos;inquilí. Els imports són els vigents el dia 1 del mes. Els contractes que ja
                tenen el rebut d&apos;aquest mes no es tornen a cobrar.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <FormField label="Mes" required>
              <Input type="month" value={periode} onChange={(event) => setPeriode(event.target.value)} required />
            </FormField>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel·lar
              </Button>
              <Button type="submit" loading={generar.isPending} disabled={!periode}>
                Generar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
