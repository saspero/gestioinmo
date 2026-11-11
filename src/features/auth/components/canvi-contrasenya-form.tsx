'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { FormField } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LONGITUD_MINIMA_CONTRASENYA } from '@/lib/validations/auth';
import { canviarContrasenyaAction, type CanviContrasenyaState } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="self-start">
      Canviar contrasenya
    </Button>
  );
}

export function CanviContrasenyaForm() {
  const [state, action] = useActionState<CanviContrasenyaState, FormData>(canviarContrasenyaAction, {});

  return (
    <form action={action} className="flex max-w-md flex-col gap-4" noValidate>
      <FormField label="Contrasenya actual" required error={state.fields?.actual}>
        <Input name="actual" type="password" autoComplete="current-password" />
      </FormField>
      <FormField
        label="Contrasenya nova"
        required
        description={`Com a mínim ${LONGITUD_MINIMA_CONTRASENYA} caràcters.`}
        error={state.fields?.nova}
      >
        <Input name="nova" type="password" autoComplete="new-password" />
      </FormField>
      <FormField label="Repeteix la contrasenya nova" required error={state.fields?.confirmacio}>
        <Input name="confirmacio" type="password" autoComplete="new-password" />
      </FormField>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-muted-foreground">
          Contrasenya canviada. S&apos;han tancat les sessions obertes en altres dispositius.
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
