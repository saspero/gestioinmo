'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginAction, type LoginState } from '../actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Entrant…' : 'Inicia sessió'}
    </Button>
  );
}

export function LoginForm({ from }: { from?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {from && <input type="hidden" name="from" value={from} />}
      <FormField label="Email" required error={state.fields?.email}>
        <Input name="email" type="email" autoComplete="username" defaultValue={state.email} autoFocus />
      </FormField>
      <FormField label="Contrasenya" required error={state.fields?.password}>
        <Input name="password" type="password" autoComplete="current-password" />
      </FormField>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
