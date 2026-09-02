'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/components/lib/utils';

/**
 * Implementat sobre el `<dialog>` natiu del navegador (gestió de focus, pila
 * de capes i tancament amb `Esc` incorporats) en lloc de `@radix-ui/react-dialog`,
 * que no forma part de les dependències del projecte.
 */

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(component: string) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error(`${component} s'ha d'usar dins d'un <Dialog>`);
  }
  return ctx;
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <DialogContext.Provider value={{ open, onOpenChange, titleId, descriptionId }}>
      {children}
    </DialogContext.Provider>
  );
}

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const { onOpenChange } = useDialogContext('DialogTrigger');
  return (
    <button
      ref={ref}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        onOpenChange(true);
      }}
      {...props}
    />
  );
});
DialogTrigger.displayName = 'DialogTrigger';

export interface DialogContentProps extends React.DialogHTMLAttributes<HTMLDialogElement> {
  showCloseButton?: boolean;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, showCloseButton = true, ...props }, ref) => {
    const { open, onOpenChange, titleId, descriptionId } = useDialogContext('DialogContent');
    const dialogRef = React.useRef<HTMLDialogElement>(null);

    React.useEffect(() => {
      const node = dialogRef.current;
      if (!node) return;
      if (open && !node.open) {
        node.showModal();
      } else if (!open && node.open) {
        node.close();
      }
    }, [open]);

    React.useEffect(() => {
      const node = dialogRef.current;
      if (!node) return;
      const handleClose = () => onOpenChange(false);
      node.addEventListener('close', handleClose);
      return () => node.removeEventListener('close', handleClose);
    }, [onOpenChange]);

    return (
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            onOpenChange(false);
          }
        }}
        className={cn(
          'm-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50 open:animate-in open:fade-in-0 open:zoom-in-95',
          className,
        )}
        {...props}
      >
        <div ref={ref} className="relative p-6">
          {children}
          {showCloseButton && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Tancar</span>
            </button>
          )}
        </div>
      </dialog>
    );
  },
);
DialogContent.displayName = 'DialogContent';

const DialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const { onOpenChange } = useDialogContext('DialogClose');
  return (
    <button
      ref={ref}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        onOpenChange(false);
      }}
      {...props}
    />
  );
});
DialogClose.displayName = 'DialogClose';

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1.5 text-left', className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const { titleId } = useDialogContext('DialogTitle');
    return (
      <h2 ref={ref} id={titleId} className={cn('text-lg font-semibold', className)} {...props} />
    );
  },
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { descriptionId } = useDialogContext('DialogDescription');
  return (
    <p
      ref={ref}
      id={descriptionId}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
