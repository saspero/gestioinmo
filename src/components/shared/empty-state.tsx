import * as React from 'react';
import { Inbox } from 'lucide-react';

import { cn } from '@/components/lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  action?: React.ReactNode;
}

/**
 * Patró "Estat buit" d'`docs/ux-flows.md` §1: text + crida a l'acció, mai
 * només una il·lustració sense sortida.
 */
function EmptyState({
  className,
  title,
  description,
  icon: Icon = Inbox,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      <Icon className="size-10 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
