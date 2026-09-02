'use client';

import * as React from 'react';

import { cn } from '@/components/lib/utils';

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltipContext(component: string) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) {
    throw new Error(`${component} s'ha d'usar dins d'un <Tooltip>`);
  }
  return ctx;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const contentId = React.useId();
  return (
    <TooltipContext.Provider value={{ open, setOpen, contentId }}>
      <span className="relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  );
}

const TooltipTrigger = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ onMouseEnter, onMouseLeave, onFocus, onBlur, children, ...props }, ref) => {
    const { setOpen, contentId } = useTooltipContext('TooltipTrigger');

    if (!React.isValidElement<React.HTMLAttributes<HTMLElement>>(children)) {
      return null;
    }

    return React.cloneElement(children, {
      ...props,
      'aria-describedby': contentId,
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
        children.props.onMouseEnter?.(event);
        setOpen(true);
      },
      onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
        children.props.onMouseLeave?.(event);
        setOpen(false);
      },
      onFocus: (event: React.FocusEvent<HTMLElement>) => {
        children.props.onFocus?.(event);
        setOpen(true);
      },
      onBlur: (event: React.FocusEvent<HTMLElement>) => {
        children.props.onBlur?.(event);
        setOpen(false);
      },
    } as React.HTMLAttributes<HTMLElement>);
  },
);
TooltipTrigger.displayName = 'TooltipTrigger';

const TooltipContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open, contentId } = useTooltipContext('TooltipContent');
    if (!open) return null;
    return (
      <div
        ref={ref}
        role="tooltip"
        id={contentId}
        className={cn(
          'absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs text-background shadow-md animate-in fade-in-0 zoom-in-95',
          className,
        )}
        {...props}
      />
    );
  },
);
TooltipContent.displayName = 'TooltipContent';

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
