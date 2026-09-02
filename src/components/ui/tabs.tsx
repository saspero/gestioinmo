'use client';

import * as React from 'react';

import { cn } from '@/components/lib/utils';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  idPrefix: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error('Els components de Tabs s\'han d\'usar dins d\'un <Tabs>');
  }
  return ctx;
}

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
}

function Tabs({ value, onValueChange, className, children, ...props }: TabsProps) {
  const idPrefix = React.useId();
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange, idPrefix }}>
      <div className={cn('flex flex-col gap-2', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const listRef = React.useRef<HTMLDivElement>(null);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const container = listRef.current;
      if (!container) return;
      const tabs = Array.from(
        container.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
      );
      const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
      if (currentIndex === -1) return;
      event.preventDefault();
      let nextIndex = currentIndex;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      tabs[nextIndex]?.focus();
      tabs[nextIndex]?.click();
    };

    return (
      <div
        ref={(node) => {
          listRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        role="tablist"
        onKeyDown={handleKeyDown}
        className={cn(
          'inline-flex h-9 w-fit items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const { value: activeValue, setValue, idPrefix } = useTabsContext();
    const selected = activeValue === value;
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${idPrefix}-tab-${value}`}
        aria-selected={selected}
        aria-controls={`${idPrefix}-panel-${value}`}
        tabIndex={selected ? 0 : -1}
        onClick={(event) => {
          onClick?.(event);
          setValue(value);
        }}
        className={cn(
          'inline-flex h-7 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          selected
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:bg-background/50 hover:text-foreground',
          className,
        )}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: activeValue, idPrefix } = useTabsContext();
    if (activeValue !== value) return null;
    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${idPrefix}-panel-${value}`}
        aria-labelledby={`${idPrefix}-tab-${value}`}
        tabIndex={0}
        className={cn('outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
        {...props}
      />
    );
  },
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
