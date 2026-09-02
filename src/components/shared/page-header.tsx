import * as React from 'react';

import { cn } from '@/components/lib/utils';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/shared/breadcrumbs';

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  /** Slot d'accions, ex: botó "Nova propietat" (visible només segons rol — ho decideix qui compon la pàgina). */
  actions?: React.ReactNode;
  className?: string;
}

/** Capçalera reutilitzada a llistats i detalls de tots els mòduls (3.2–3.7). */
function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export { PageHeader };
