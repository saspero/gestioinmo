import * as React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react';

import { cn } from '@/components/lib/utils';
import { buttonVariants } from '@/components/ui/button';

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="Paginació"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

const PaginationContent = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
  ),
);
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => <li ref={ref} className={className} {...props} />,
);
PaginationItem.displayName = 'PaginationItem';

interface PaginationLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
}

function PaginationLink({ className, isActive = false, ...props }: PaginationLinkProps) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? 'outline' : 'ghost', size: 'icon' }),
        className,
      )}
      {...props}
    />
  );
}

function PaginationFirst({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <PaginationLink aria-label="Primera pàgina" className={cn('gap-1', className)} {...props}>
      <ChevronsLeft aria-hidden="true" />
    </PaginationLink>
  );
}

function PaginationPrevious({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <PaginationLink aria-label="Pàgina anterior" className={cn('gap-1', className)} {...props}>
      <ChevronLeft aria-hidden="true" />
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <PaginationLink aria-label="Pàgina següent" className={cn('gap-1', className)} {...props}>
      <ChevronRight aria-hidden="true" />
    </PaginationLink>
  );
}

function PaginationLast({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <PaginationLink aria-label="Última pàgina" className={cn('gap-1', className)} {...props}>
      <ChevronsRight aria-hidden="true" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden="true" className={cn('flex size-9 items-center justify-center', className)} {...props}>
      <MoreHorizontal className="size-4" />
      <span className="sr-only">Més pàgines</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationFirst,
  PaginationPrevious,
  PaginationNext,
  PaginationLast,
  PaginationEllipsis,
};
