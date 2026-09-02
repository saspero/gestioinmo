import * as React from 'react';
import { CircleAlert } from 'lucide-react';

import { cn } from '@/components/lib/utils';
import { Button } from '@/components/ui/button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Patró "Estat d'error" d'`docs/ux-flows.md` §1: missatge + acció de
 * reintentar, mai una pantalla en blanc.
 */
function ErrorState({
  className,
  title = "S'ha produït un error inesperat.",
  description = "Torna-ho a provar d'aquí una estona.",
  onRetry,
  retryLabel = 'Reintentar',
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-border px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      <CircleAlert className="size-10 text-destructive" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export { ErrorState };
