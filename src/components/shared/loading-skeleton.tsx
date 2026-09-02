import * as React from 'react';

import { cn } from '@/components/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  variant: 'table';
  rows?: number;
  columns?: number;
}

interface DetailSkeletonProps {
  variant: 'detail';
  sections?: number;
}

interface CardSkeletonProps {
  variant: 'cards';
  cards?: number;
}

export type LoadingSkeletonProps = (TableSkeletonProps | DetailSkeletonProps | CardSkeletonProps) & {
  className?: string;
};

/**
 * Patró "Estat de càrrega" d'`docs/ux-flows.md` §1: esquelet amb la forma del
 * contingut final, mai un espinner sol.
 */
function LoadingSkeleton(props: LoadingSkeletonProps) {
  const { className } = props;

  if (props.variant === 'table') {
    const rows = props.rows ?? 6;
    const columns = props.columns ?? 4;
    return (
      <div className={cn('flex flex-col gap-2', className)} aria-hidden>
        <div className="flex gap-4 border-b border-border pb-2">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex gap-4 py-1.5">
            {Array.from({ length: columns }).map((_, col) => (
              <Skeleton key={col} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (props.variant === 'detail') {
    const sections = props.sections ?? 2;
    return (
      <div className={cn('flex flex-col gap-6', className)} aria-hidden>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        {Array.from({ length: sections }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const cards = props.cards ?? 4;
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)} aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export { LoadingSkeleton };
