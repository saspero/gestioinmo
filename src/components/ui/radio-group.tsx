import * as React from 'react';

import { cn } from '@/components/lib/utils';

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = React.createContext<{
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
} | null>(null);

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, name, value, onValueChange, role = 'radiogroup', ...props }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ name, value, onValueChange }}>
        <div ref={ref} role={role} className={cn('grid gap-2', className)} {...props} />
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = 'RadioGroup';

export interface RadioGroupItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'name' | 'size'> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, id, ...props }, ref) => {
    const group = React.useContext(RadioGroupContext);
    if (!group) {
      throw new Error('RadioGroupItem s\'ha d\'usar dins d\'un RadioGroup');
    }
    return (
      <input
        ref={ref}
        id={id}
        type="radio"
        name={group.name}
        value={value}
        checked={group.value === value}
        onChange={() => group.onValueChange?.(value)}
        className={cn(
          'size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-input bg-background transition-colors checked:border-[5px] checked:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
