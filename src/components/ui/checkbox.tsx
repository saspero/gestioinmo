import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/components/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <span className={cn('relative inline-flex size-4 shrink-0', className)}>
        <input
          ref={ref}
          type="checkbox"
          className={cn(
            'peer size-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-input bg-background transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...props}
        />
        <Check
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
        />
      </span>
    );
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
