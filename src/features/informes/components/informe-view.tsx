'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { apiFetch, apiFetchBinary, buildQueryString, ApiFetchError } from '@/hooks/api-client';
import { useListPropietats } from '@/hooks/use-propietats';
import { useListPropietaris } from '@/hooks/use-propietaris';
import { ErrorState, FormField, LoadingSkeleton } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { avuiLocal } from '@/lib/validations/contractes';
import {
  definicioInforme,
  formatValor,
  periodePerDefecte,
  type ColumnaInforme,
  type InformeId,
  type ResultatInforme,
} from '@/lib/validations/informes';

const alineaDreta = (columna: ColumnaInforme) => columna.tipus !== 'text' && columna.tipus !== 'data';

export function InformeView({ id }: { id: InformeId }) {
  const definicio = definicioInforme(id);
  const perDefecte = React.useMemo(() => periodePerDefecte(definicio.periode, avuiLocal()), [definicio.periode]);
  const [dataInici, setDataInici] = React.useState(perDefecte?.dataInici ?? '');
  const [dataFi, setDataFi] = React.useState(perDefecte?.dataFi ?? '');
  const [propietatId, setPropietatId] = React.useState('');
  const [propietariId, setPropietariId] = React.useState('');
  const [descarregant, setDescarregant] = React.useState<'csv' | 'pdf' | null>(null);

  const { data: propietats } = useListPropietats({ pageSize: 100 });
  const { data: propietaris } = useListPropietaris({ pageSize: 100 });

  const ambPeriode = definicio.periode !== 'cap';
  const periodeErroni = ambPeriode && dataInici !== '' && dataFi !== '' && dataFi < dataInici;
  const filtres = {
    dataInici: ambPeriode ? dataInici || undefined : undefined,
    dataFi: ambPeriode ? dataFi || undefined : undefined,
    propietatId: propietatId || undefined,
    propietariId: propietariId || undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['informes', 'llistat', id, filtres],
    queryFn: () =>
      apiFetch<ResultatInforme>(`/api/informes/llistats/${id}${buildQueryString(filtres)}`).then((res) => res.data),
    enabled: !periodeErroni,
  });

  async function descarregar(format: 'csv' | 'pdf') {
    setDescarregant(format);
    try {
      const contingut = await apiFetchBinary(`/api/informes/llistats/${id}${buildQueryString({ ...filtres, format })}`);
      const blob = new Blob([contingut], { type: format === 'pdf' ? 'application/pdf' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const enllac = document.createElement('a');
      enllac.href = url;
      enllac.download = `${id}-${avuiLocal()}.${format}`;
      enllac.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: "No s'ha pogut descarregar",
        description: error instanceof ApiFetchError ? error.message : "S'ha produït un error inesperat.",
      });
    } finally {
      setDescarregant(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          {ambPeriode && (
            <>
              <FormField label="Des del" className="sm:max-w-[10rem]">
                <Input type="date" value={dataInici} onChange={(event) => setDataInici(event.target.value)} />
              </FormField>
              <FormField label="Fins al" className="sm:max-w-[10rem]">
                <Input type="date" value={dataFi} onChange={(event) => setDataFi(event.target.value)} />
              </FormField>
            </>
          )}
          <FormField label="Propietat" className="sm:max-w-[14rem]">
            <Select value={propietatId} onChange={(event) => setPropietatId(event.target.value)}>
              <option value="">Totes</option>
              {(propietats?.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.referencia}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Propietari" className="sm:max-w-[14rem]">
            <Select value={propietariId} onChange={(event) => setPropietariId(event.target.value)}>
              <option value="">Tots</option>
              {(propietaris?.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.nom, p.cognoms].filter(Boolean).join(' ')}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => descarregar('pdf')}
            loading={descarregant === 'pdf'}
            disabled={periodeErroni}
          >
            <Download /> PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => descarregar('csv')}
            loading={descarregant === 'csv'}
            disabled={periodeErroni}
          >
            <Download /> CSV (Excel)
          </Button>
        </div>
      </div>

      {periodeErroni ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          La data d&apos;inici ha de ser anterior a la data de fi.
        </p>
      ) : isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Taula resultat={data} />
      )}
    </div>
  );
}

function Taula({ resultat }: { resultat: ResultatInforme }) {
  if (resultat.files.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">Cap resultat amb aquests filtres.</CardContent>
      </Card>
    );
  }
  const { columnes, totals } = resultat;
  return (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              {columnes.map((c) => (
                <th key={c.id} className={`whitespace-nowrap py-2 pr-4 font-medium ${alineaDreta(c) ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resultat.files.map((fila, index) => (
              <tr key={index} className="border-b border-border last:border-0">
                {columnes.map((c) => (
                  <td
                    key={c.id}
                    className={`py-2 pr-4 ${alineaDreta(c) ? 'whitespace-nowrap text-right tabular-nums' : ''} ${
                      c.tipus === 'data' ? 'whitespace-nowrap' : ''
                    }`}
                  >
                    {formatValor(fila[c.id], c.tipus)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                {columnes.map((c, index) => (
                  <td key={c.id} className={`pt-3 pr-4 ${alineaDreta(c) ? 'whitespace-nowrap text-right tabular-nums' : ''}`}>
                    {index === 0 ? 'Total' : c.id in totals ? formatValor(totals[c.id], c.tipus) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </CardContent>
    </Card>
  );
}
