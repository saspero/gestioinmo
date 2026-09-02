import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/components/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Format `[Mòdul] / [Entitat concreta]` d'`docs/ux-flows.md` §5, present a
 * totes les pantalles de detall i formulari.
 */
function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm', className)}>
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="text-muted-foreground hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={isLast ? 'font-medium text-foreground' : 'text-muted-foreground'}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumbs };
