'use client';

import * as React from 'react';

import { cn } from '@/components/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * Variant d'AlertDialog sobre `<dialog>` natiu (vegeu `dialog.tsx`): sense
 * botó de tancament flotant, ja que les accions es prenen sempre via
 * `AlertDialogAction` / `AlertDialogCancel`.
 */

interface AlertDialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

function useAlertDialogContext(component: string) {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) {
    throw new Error(`${component} s'ha d'usar dins d'un <AlertDialog>`);
  }
  return ctx;
}

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <AlertDialogContext.Provider value={{ open, onOpenChange, titleId, descriptionId }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

const AlertDialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ onClick, ...props }, ref) => {
  const { onOpenChange } = useAlertDialogContext('AlertDialogTrigger');
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
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  React.DialogHTMLAttributes<HTMLDialogElement>
>(({ className, children, ...props }, ref) => {
    const { open, onOpenChange, titleId, descriptionId } = useAlertDialogContext(
      'AlertDialogContent',
    );
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
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          'm-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50 open:animate-in open:fade-in-0 open:zoom-in-95',
          className,
        )}
        {...props}
      >
        <div ref={ref} className="p-6">
          {children}
        </div>
      </dialog>
    );
  },
);
AlertDialogContent.displayName = 'AlertDialogContent';

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col gap-1.5 text-left', className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

const AlertDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const { titleId } = useAlertDialogContext('AlertDialogTitle');
  return <h2 ref={ref} id={titleId} className={cn('text-lg font-semibold', className)} {...props} />;
});
AlertDialogTitle.displayName = 'AlertDialogTitle';

const AlertDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { descriptionId } = useAlertDialogContext('AlertDialogDescription');
  return (
    <p
      ref={ref}
      id={descriptionId}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});
AlertDialogDescription.displayName = 'AlertDialogDescription';

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { onOpenChange } = useAlertDialogContext('AlertDialogAction');
  return (
    <button
      ref={ref}
      type="button"
      className={cn(buttonVariants({ variant: 'destructive' }), className)}
      onClick={(event) => {
        onClick?.(event);
        onOpenChange(false);
      }}
      {...props}
    />
  );
});
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { onOpenChange } = useAlertDialogContext('AlertDialogCancel');
  return (
    <button
      ref={ref}
      type="button"
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      onClick={(event) => {
        onClick?.(event);
        onOpenChange(false);
      }}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = 'AlertDialogCancel';

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
