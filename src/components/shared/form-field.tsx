import * as React from 'react';

import { cn } from '@/components/lib/utils';
import { Label } from '@/components/ui/label';

type ControlProps = {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  description?: string;
  /** Missatge d'error específic del camp (sortida de `Zod .flatten()` a l'API/Server Action). */
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement<ControlProps>;
}

/**
 * Wrapper Label + control + missatge d'error (`docs/agents/AGENT_UI_COMPONENTS.md` §3):
 * associa `label`/`aria-describedby` amb el control per a formularis consistents
 * sense repetir marcatge a cada mòdul. Els errors es mostren sota cada camp,
 * mai com un únic missatge genèric (`docs/ux-flows.md` §4, codi 400).
 */
function FormField({
  label,
  htmlFor,
  description,
  error,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const generatedId = React.useId();
  const id = htmlFor ?? generatedId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  const control = React.cloneElement(children, {
    id,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
  });

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {control}
      {description && !error && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export { FormField };
