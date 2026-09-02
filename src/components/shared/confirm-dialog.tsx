'use client';

import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/components/lib/utils';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Títol curt de l'acció, ex: "Resoldre contracte". */
  title: string;
  /**
   * Text explícit de la conseqüència de l'acció (`docs/ux-flows.md` §1):
   * mai un "Estàs segur?" genèric.
   */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estils del botó d'acció; `true` aplica la variant destructiva per defecte. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * Patró "Confirmació d'acció destructiva/irreversible" d'`docs/ux-flows.md`
 * §1: baixa de propietat/propietari/inquilí, resolució de contracte,
 * resolució d'incidència.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancel·lar',
  destructive = true,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            className={cn(!destructive && buttonVariants({ variant: 'default' }))}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ConfirmDialog };
