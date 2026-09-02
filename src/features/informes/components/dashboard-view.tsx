'use client';

// No hi ha `use-informes.ts` a `src/hooks/`: es consulta `/api/informes/dashboard` amb
// `useQuery` + `apiFetch` inline, seguint les mateixes convencions que la resta de hooks
// del projecte (docs/architecture.md §5.1, mateix envelope `{ data, meta } | { error }`).

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, TriangleAlert, Wallet, Wrench } from 'lucide-react';

import { apiFetch, buildQueryString } from '@/hooks/api-client';
import { useListPropietats } from '@/hooks/use-propietats';
import { LoadingSkeleton, ErrorState } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared';
import type { DashboardIndicadors } from '@/features/informes/types';

export function DashboardView() {
  const [dataInici, setDataInici] = React.useState('');
  const [dataFi, setDataFi] = React.useState('');
  const [propietatId, setPropietatId] = React.useState('');

  const { data: propietats } = useListPropietats({ pageSize: 100 });

  const filters = { dataInici: dataInici || undefined, dataFi: dataFi || undefined, propietatId: propietatId || undefined };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['informes', 'dashboard', filters],
    queryFn: () =>
      apiFetch<DashboardIndicadors>(`/api/informes/dashboard${buildQueryString(filters)}`).then((res) => res.data),
  });

  if (dataInici && dataFi && dataInici > dataFi) {
    return (
      <div className="flex flex-col gap-6">
        <FiltersForm
          dataInici={dataInici}
          dataFi={dataFi}
          propietatId={propietatId}
          setDataInici={setDataInici}
          setDataFi={setDataFi}
          setPropietatId={setPropietatId}
          propietats={propietats?.data ?? []}
        />
        <p role="alert" className="text-sm font-medium text-destructive">
          La data d&apos;inici ha de ser anterior a la data de fi.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FiltersForm
        dataInici={dataInici}
        dataFi={dataFi}
        propietatId={propietatId}
        setDataInici={setDataInici}
        setDataFi={setDataFi}
        setPropietatId={setPropietatId}
        propietats={propietats?.data ?? []}
      />

      {isError ? (
        <ErrorState title="No s'ha pogut carregar el dashboard." onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <LoadingSkeleton variant="cards" cards={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <IndicatorCard
            icon={Building2}
            label="Ocupació"
            value={`${data.ocupacio.percentatge}%`}
            description={`${data.ocupacio.unitatsOcupades} de ${data.ocupacio.totalUnitats} unitats`}
            href="/propietats"
          />
          <IndicatorCard
            icon={TriangleAlert}
            label="Morositat"
            value={String(data.morositat.inquilinsMorosos)}
            description={`${data.morositat.importPendentMora} € pendents`}
            href="/inquilins?estatInquili=moros"
          />
          <IndicatorCard
            icon={Wallet}
            label="Ingressos"
            value={`${data.ingressos.cobrat} €`}
            description={`Previst: ${data.ingressos.previst} €`}
            href="/pagaments"
          />
          <IndicatorCard
            icon={Wrench}
            label="Incidències obertes"
            value={String(data.incidenciesObertes)}
            description="Oberta, assignada o en curs"
            href="/incidencies?estat=oberta"
          />
        </div>
      )}
    </div>
  );
}

interface FiltersFormProps {
  dataInici: string;
  dataFi: string;
  propietatId: string;
  setDataInici: (value: string) => void;
  setDataFi: (value: string) => void;
  setPropietatId: (value: string) => void;
  propietats: { id: string; referencia: string }[];
}

function FiltersForm({ dataInici, dataFi, propietatId, setDataInici, setDataFi, setPropietatId, propietats }: FiltersFormProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <FormField label="Data d'inici" className="sm:max-w-[10rem]">
        <Input type="date" value={dataInici} onChange={(event) => setDataInici(event.target.value)} />
      </FormField>
      <FormField label="Data de fi" className="sm:max-w-[10rem]">
        <Input type="date" value={dataFi} onChange={(event) => setDataFi(event.target.value)} />
      </FormField>
      <FormField label="Propietat" className="sm:max-w-[14rem]">
        <Select value={propietatId} onChange={(event) => setPropietatId(event.target.value)}>
          <option value="">Totes les propietats</option>
          {propietats.map((p) => (
            <option key={p.id} value={p.id}>
              {p.referencia}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}

interface IndicatorCardProps {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: string;
  description: string;
  href: string;
}

function IndicatorCard({ icon: Icon, label, value, description, href }: IndicatorCardProps) {
  return (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
