'use client';

import { Toast, ToastClose, ToastDescription, ToastTitle, ToastViewport } from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';

/**
 * Munta's un únic cop a l'arrel de l'aplicació (fora de l'scope d'aquest
 * agent). Les notificacions es disparen des de qualsevol Client Component amb
 * `toast({ title, description, variant })` (`use-toast.ts`).
 */
function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastViewport>
      {toasts
        .filter((t) => t.open)
        .map(({ id, title, description, action, variant }) => (
          <Toast key={id} variant={variant}>
            <div className="grid flex-1 gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        ))}
    </ToastViewport>
  );
}

export { Toaster };
