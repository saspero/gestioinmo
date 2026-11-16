'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LONGITUD_MINIMA_CONTRASENYA } from '@/lib/validations/auth';
import { MINUTS_VALIDESA_RECUPERACIO } from '@/lib/auth/recuperacio-constants';
import {
  restablirContrasenyaAction,
  sollicitarRecuperacioAction,
  type RecuperacioState,
  type RestablirState,
} from '../recuperacio-actions';

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending}>
      {children}
    </Button>
  );
}

const TORNAR = (
  <Link href="/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
    Torna a l&apos;inici de sessió
  </Link>
);

export function SollicitarRecuperacioForm() {
  const [state, action] = useActionState<RecuperacioState, FormData>(sollicitarRecuperacioAction, {});

  if (state.enviat) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm text-foreground">
          Si <strong>{state.email}</strong> correspon a un compte actiu, t&apos;hi hem enviat un enllaç per triar una
          contrasenya nova. Caduca d&apos;aquí {MINUTS_VALIDESA_RECUPERACIO} minuts.
        </p>
        <p className="text-sm text-muted-foreground">
          Si no el reps, mira la carpeta de correu brossa o demana a l&apos;administrador de la teva agència que te la
          restableixi.
        </p>
        {TORNAR}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormField label="Email" required error={state.fields?.email}>
        <Input name="email" type="email" autoComplete="username" defaultValue={state.email} autoFocus />
      </FormField>
      <SubmitButton>Envia l&apos;enllaç</SubmitButton>
      {TORNAR}
    </form>
  );
}

export function RestablirContrasenyaForm({ token }: { token: string }) {
  const [state, action] = useActionState<RestablirState, FormData>(restablirContrasenyaAction, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormField
        label="Contrasenya nova"
        required
        description={`Com a mínim ${LONGITUD_MINIMA_CONTRASENYA} caràcters.`}
        error={state.fields?.nova}
      >
        <Input name="nova" type="password" autoComplete="new-password" autoFocus />
      </FormField>
      <FormField label="Repeteix la contrasenya nova" required error={state.fields?.confirmacio}>
        <Input name="confirmacio" type="password" autoComplete="new-password" />
      </FormField>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <SubmitButton>Desa la contrasenya</SubmitButton>
      {TORNAR}
    </form>
  );
}
