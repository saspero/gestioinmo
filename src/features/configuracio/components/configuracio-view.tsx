'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { ConfirmDialog, DataTable, FormField } from '@/components/shared';
import type { ColumnDef } from '@/components/shared/data-table/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import type { TenantConfig, UsuariIntern } from '@/lib/db/usuaris';
import {
  canviarEstatUsuariAction,
  crearUsuariAction,
  guardarTenantAction,
  restablirContrasenyaAction,
  type ConfigState,
} from '../actions';

const ETIQUETES_ROL: Record<UsuariIntern['rol'], string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  comptable: 'Comptable',
};

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="self-start">
      {children}
    </Button>
  );
}

function ErrorFormulari({ missatge }: { missatge?: string }) {
  if (!missatge) return null;
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {missatge}
    </p>
  );
}

function ContrasenyaTemporal({ password, children }: { password: string; children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">
      <p>{children}</p>
      <code className="mt-1 block select-all font-mono">{password}</code>
      <p className="mt-1 text-xs text-muted-foreground">
        Copia-la ara: no es tornarà a mostrar. Fes-la arribar a l&apos;usuari per un canal segur.
      </p>
    </div>
  );
}

function AgenciaForm({ tenant }: { tenant: TenantConfig }) {
  const [state, action] = useActionState<ConfigState, FormData>(guardarTenantAction, {});

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4" noValidate>
      <FormField label="Nom de l'agència" required error={state.fields?.nom}>
        <Input name="nom" defaultValue={tenant.nom} />
      </FormField>
      <FormField label="NIF/CIF" error={state.fields?.nif}>
        <Input name="nif" defaultValue={tenant.nif} />
      </FormField>
      <FormField label="Adreça fiscal" error={state.fields?.adreca}>
        <Input name="adreca" defaultValue={tenant.adreca} />
      </FormField>
      <FormField
        label="Expiració de la sessió (minuts)"
        required
        description="S'aplica a les sessions que s'iniciïn a partir d'ara."
        error={state.fields?.jwtExpiracioMinuts}
      >
        <Input name="jwtExpiracioMinuts" type="number" min={5} max={1440} defaultValue={tenant.jwtExpiracioMinuts} />
      </FormField>
      <ErrorFormulari missatge={state.error} />
      {state.ok && (
        <p role="status" className="text-sm text-muted-foreground">
          Canvis desats.
        </p>
      )}
      <SubmitButton>Desar</SubmitButton>
    </form>
  );
}

function NouUsuariForm() {
  const [state, action] = useActionState<ConfigState, FormData>(crearUsuariAction, {});

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4 rounded-lg border border-border p-4" noValidate>
      <h2 className="text-sm font-semibold text-foreground">Nou usuari</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Nom" required error={state.fields?.nom}>
          <Input name="nom" />
        </FormField>
        <FormField label="Cognoms" error={state.fields?.cognoms}>
          <Input name="cognoms" />
        </FormField>
      </div>
      <FormField label="Email" required error={state.fields?.email}>
        <Input name="email" type="email" />
      </FormField>
      <FormField label="Rol" required error={state.fields?.rol}>
        <Select name="rol" defaultValue="gestor">
          {Object.entries(ETIQUETES_ROL).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </Select>
      </FormField>
      <ErrorFormulari missatge={state.error} />
      {state.passwordTemporal && (
        <ContrasenyaTemporal password={state.passwordTemporal}>
          Usuari <strong>{state.emailCreat}</strong> creat. Contrasenya temporal:
        </ContrasenyaTemporal>
      )}
      <SubmitButton>Crear usuari</SubmitButton>
    </form>
  );
}

function UsuarisSection({ usuaris, usuariActualId }: { usuaris: UsuariIntern[]; usuariActualId: string }) {
  const [pendent, startTransition] = React.useTransition();
  const [aRestablir, setARestablir] = React.useState<UsuariIntern | null>(null);
  const [restablerta, setRestablerta] = React.useState<{ email: string; password: string } | null>(null);

  function restablir() {
    const usuari = aRestablir;
    if (!usuari) return;
    startTransition(async () => {
      const result = await restablirContrasenyaAction(usuari.id);
      setARestablir(null);
      if (result.passwordTemporal) {
        setRestablerta({ email: usuari.email, password: result.passwordTemporal });
      } else {
        toast({
          variant: 'destructive',
          title: "No s'ha pogut restablir la contrasenya",
          description: result.error,
        });
      }
    });
  }

  function canviarEstat(usuari: UsuariIntern) {
    startTransition(async () => {
      const result = await canviarEstatUsuariAction(usuari.id, !usuari.actiu);
      if (result.error) {
        toast({ variant: 'destructive', title: "No s'ha pogut canviar l'estat", description: result.error });
      }
    });
  }

  const columns: ColumnDef<UsuariIntern>[] = [
    { id: 'nom', header: 'Nom', cell: (row) => row.nom },
    { id: 'email', header: 'Email', cell: (row) => row.email },
    { id: 'rol', header: 'Rol', cell: (row) => ETIQUETES_ROL[row.rol] },
    { id: 'estat', header: 'Estat', cell: (row) => (row.actiu ? 'Actiu' : 'Desactivat') },
    { id: 'ultimLogin', header: 'Últim accés', cell: (row) => row.ultimLogin ?? '—' },
    {
      id: 'accions',
      header: 'Accions',
      cell: (row) =>
        row.id === usuariActualId ? (
          '—'
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={pendent} onClick={() => canviarEstat(row)}>
              {row.actiu ? 'Desactivar' : 'Reactivar'}
            </Button>
            <Button variant="outline" size="sm" disabled={pendent} onClick={() => setARestablir(row)}>
              Restablir contrasenya
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {restablerta && (
        <ContrasenyaTemporal password={restablerta.password}>
          Contrasenya de <strong>{restablerta.email}</strong> restablerta. Contrasenya temporal:
        </ContrasenyaTemporal>
      )}
      <DataTable columns={columns} data={usuaris} getRowId={(row) => row.id} />
      <ConfirmDialog
        open={aRestablir !== null}
        onOpenChange={(open) => {
          if (!open) setARestablir(null);
        }}
        title="Restablir contrasenya"
        description={
          aRestablir &&
          `Es generarà una contrasenya temporal nova per a ${aRestablir.email}. La que té ara deixarà de funcionar i es tancaran les seves sessions.`
        }
        confirmLabel="Restablir"
        loading={pendent}
        onConfirm={restablir}
      />
      <NouUsuariForm />
    </div>
  );
}

interface ConfiguracioViewProps {
  tenant: TenantConfig;
  usuaris: UsuariIntern[];
  usuariActualId: string;
}

export function ConfiguracioView({ tenant, usuaris, usuariActualId }: ConfiguracioViewProps) {
  const [tab, setTab] = React.useState('agencia');

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="agencia">Agència</TabsTrigger>
        <TabsTrigger value="usuaris">Usuaris</TabsTrigger>
      </TabsList>
      <TabsContent value="agencia" className="pt-4">
        <AgenciaForm tenant={tenant} />
      </TabsContent>
      <TabsContent value="usuaris" className="pt-4">
        <UsuarisSection usuaris={usuaris} usuariActualId={usuariActualId} />
      </TabsContent>
    </Tabs>
  );
}
