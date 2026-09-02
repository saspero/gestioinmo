'use client';

import * as React from 'react';

import { useCobrarPagament, type Pagament } from '@/hooks/use-pagaments';
import { ApiFetchError } from '@/hooks/api-client';
import { FormField } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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
import { METODE_PAGAMENT_OPTIONS } from '@/features/pagaments/types';

interface CobrarDialogProps {
  pagament: Pagament;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CobrarDialog({ pagament, open, onOpenChange }: CobrarDialogProps) {
  const cobrarPagament = useCobrarPagament(pagament.id);
  const [dataCobrament, setDataCobrament] = React.useState(new Date().toISOString().slice(0, 10));
  const [metode, setMetode] = React.useState<string>('transferencia');
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      await cobrarPagament.mutateAsync({
        dataCobrament,
        metode: metode as 'domiciliacio' | 'transferencia' | 'efectiu' | 'targeta' | 'altres',
      });
      toast({ title: 'Rebut marcat com a cobrat' });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "S'ha produït un error inesperat.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Marcar rebut com a cobrat</DialogTitle>
            <DialogDescription>
              {pagament.concepte} — {pagament.import} €
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <FormField label="Data de cobrament" required>
            <Input
              type="date"
              value={dataCobrament}
              onChange={(event) => setDataCobrament(event.target.value)}
              required
            />
          </FormField>
          <FormField label="Mètode" required>
            <Select value={metode} onChange={(event) => setMetode(event.target.value)}>
              {METODE_PAGAMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel·lar
            </Button>
            <Button type="submit" loading={cobrarPagament.isPending}>
              Marcar com a cobrat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
