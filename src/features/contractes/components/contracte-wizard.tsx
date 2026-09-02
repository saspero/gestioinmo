'use client';

// Wizard multi-pas d'alta de contracte (docs/ux-flows.md §3.5, patró "Wizard
// multi-pas" §1). No hi ha `useListUnitats` a `src/hooks/`: la disponibilitat d'unitats
// es consulta amb `apiFetch` + `useQuery` inline, amb la mateixa clau de caché que
// `src/features/propietats/components/unitats-section.tsx` (`['propietats', id, 'unitats']`)
// perquè totes dues vistes comparteixin la mateixa dada.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';

import { apiFetch, ApiFetchError } from '@/hooks/api-client';
import { useListPropietats, type Propietat } from '@/hooks/use-propietats';
import { useListInquilins, useCreateInquili, type Inquili } from '@/hooks/use-inquilins';
import { useCreateContracte, contractesKeys, type CrearContracteInput } from '@/hooks/use-contractes';
import { FormField, EmptyState } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import { TIPUS_US_OPTIONS, type UnitatDisponible } from '@/features/contractes/types';

interface ContracteWizardProps {
  unitatIdInicial?: string;
  propietatIdInicial?: string;
}

type Step = 1 | 2 | 3 | 4;

function useUnitatsPropietat(propietatId: string) {
  return useQuery({
    queryKey: ['propietats', propietatId, 'unitats'],
    queryFn: () => apiFetch<UnitatDisponible[]>(`/api/propietats/${propietatId}/unitats`).then((res) => res.data),
    enabled: !!propietatId,
  });
}

export function ContracteWizard({ unitatIdInicial, propietatIdInicial }: ContracteWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = React.useState<Step>(1);
  const [propietatId, setPropietatId] = React.useState(propietatIdInicial ?? '');
  const [unitatId, setUnitatId] = React.useState(unitatIdInicial ?? '');
  const [unitatBloquejada, setUnitatBloquejada] = React.useState(Boolean(unitatIdInicial && propietatIdInicial));

  const [inquilinsSeleccionats, setInquilinsSeleccionats] = React.useState<Inquili[]>([]);

  const [tipusUs, setTipusUs] = React.useState<string>('habitatge');
  const [dataInici, setDataInici] = React.useState('');
  const [dataFi, setDataFi] = React.useState('');
  const [renda, setRenda] = React.useState('');
  const [fianca, setFianca] = React.useState('');
  const [indexActualitzacio, setIndexActualitzacio] = React.useState('IPC');
  const [percentatgePactat, setPercentatgePactat] = React.useState('');
  const [documentUrl, setDocumentUrl] = React.useState('');

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = React.useState<'esborrany' | 'actiu' | null>(null);

  const createContracte = useCreateContracte();
  const { data: unitats } = useUnitatsPropietat(propietatId);
  const unitatSeleccionada = unitats?.find((u) => u.id === unitatId);
  // Recomprova la disponibilitat just abans de confirmar (docs/ux-flows.md §3.5, pas 4).
  const unitatEncaraVacant = !unitatSeleccionada || unitatSeleccionada.estat === 'vacant';

  const rendaNum = Number(renda) || 0;
  const fiancaFora =
    tipusUs === 'habitatge' && fianca !== '' && (Number(fianca) < rendaNum || Number(fianca) > rendaNum * 2);

  function canAdvanceFrom(current: Step): boolean {
    if (current === 1) return Boolean(unitatId);
    if (current === 2) return inquilinsSeleccionats.length > 0;
    if (current === 3) return Boolean(dataInici) && rendaNum > 0 && fianca !== '' && !fiancaFora;
    return true;
  }

  async function handleCreate(mode: 'esborrany' | 'actiu') {
    setFormError(undefined);
    setFieldErrors({});
    setSubmitting(mode);

    const input: CrearContracteInput = {
      unitatId,
      tipusUs,
      dataInici,
      dataFi: dataFi || undefined,
      renda: rendaNum,
      fianca: Number(fianca),
      indexActualitzacio,
      percentatgePactat: percentatgePactat ? Number(percentatgePactat) : undefined,
      documentUrl: documentUrl || undefined,
      inquilinsIds: inquilinsSeleccionats.map((i) => i.id),
    };

    try {
      const contracte = await createContracte.mutateAsync(input);

      if (mode === 'actiu') {
        try {
          await apiFetch(`/api/contractes/${contracte.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ estat: 'actiu' }),
          });
        } catch (activationError) {
          queryClient.invalidateQueries({ queryKey: contractesKeys.detail(contracte.id) });
          const message =
            activationError instanceof ApiFetchError
              ? activationError.message
              : "S'ha produït un error inesperat en activar el contracte.";
          toast({
            variant: 'destructive',
            title: 'Contracte creat com a esborrany',
            description: `No s'ha pogut activar automàticament: ${message}`,
          });
          router.push(`/contractes/${contracte.id}`);
          return;
        }
        queryClient.invalidateQueries({ queryKey: contractesKeys.detail(contracte.id) });
      }

      queryClient.invalidateQueries({ queryKey: contractesKeys.lists() });
      toast({ title: mode === 'actiu' ? 'Contracte creat i activat' : 'Contracte creat com a esborrany' });
      router.push(`/contractes/${contracte.id}`);
    } catch (error) {
      if (error instanceof ApiFetchError) {
        setFieldErrors(error.fields ?? {});
        setFormError(error.message);
      } else {
        setFormError("S'ha produït un error inesperat. Torna-ho a provar més tard.");
      }
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <ol className="flex items-center gap-2 text-sm">
        {(['Unitat', 'Inquilins', 'Condicions', 'Confirmació'] as const).map((label, index) => {
          const stepNumber = (index + 1) as Step;
          const active = stepNumber === step;
          const done = stepNumber < step;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={
                  'flex size-6 items-center justify-center rounded-full text-xs font-semibold ' +
                  (active
                    ? 'bg-primary text-primary-foreground'
                    : done
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-muted text-muted-foreground')
                }
              >
                {done ? <Check className="size-3.5" aria-hidden /> : stepNumber}
              </span>
              <span className={active ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</span>
              {index < 3 && <span className="mx-1 text-muted-foreground">—</span>}
            </li>
          );
        })}
      </ol>

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          {unitatBloquejada && unitatSeleccionada ? (
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Unitat preseleccionada</p>
                <p className="text-sm text-muted-foreground">{unitatSeleccionada.referencia}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setUnitatBloquejada(false);
                  setUnitatId('');
                }}
              >
                Canviar unitat
              </Button>
            </div>
          ) : (
            <UnitatStep
              propietatId={propietatId}
              setPropietatId={(id) => {
                setPropietatId(id);
                setUnitatId('');
              }}
              unitatId={unitatId}
              setUnitatId={setUnitatId}
            />
          )}
        </div>
      )}

      {step === 2 && (
        <InquilinsStep
          seleccionats={inquilinsSeleccionats}
          onChange={setInquilinsSeleccionats}
        />
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <FormField label="Tipus d'ús" required error={fieldErrors.tipusUs}>
            <Select value={tipusUs} onChange={(event) => setTipusUs(event.target.value)}>
              {TIPUS_US_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Data d'inici" required error={fieldErrors.dataInici}>
              <Input type="date" value={dataInici} onChange={(event) => setDataInici(event.target.value)} required />
            </FormField>
            <FormField label="Data de fi" description="Opcional" error={fieldErrors.dataFi}>
              <Input type="date" value={dataFi} onChange={(event) => setDataFi(event.target.value)} />
            </FormField>
          </div>

          <FormField label="Renda mensual (€)" required error={fieldErrors.renda}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={renda}
              onChange={(event) => setRenda(event.target.value)}
              required
            />
          </FormField>

          <FormField
            label="Fiança (€)"
            required
            error={
              fieldErrors.fianca ??
              (fiancaFora
                ? `Per a un contracte d'habitatge, la fiança ha d'estar entre una i dues mensualitats (entre ${rendaNum}€ i ${rendaNum * 2}€).`
                : undefined)
            }
            description={tipusUs === 'habitatge' && rendaNum > 0 ? `Rang vàlid: ${rendaNum}€ – ${rendaNum * 2}€` : undefined}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={fianca}
              onChange={(event) => setFianca(event.target.value)}
              required
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Índex d'actualització" error={fieldErrors.indexActualitzacio}>
              <Input value={indexActualitzacio} onChange={(event) => setIndexActualitzacio(event.target.value)} />
            </FormField>
            <FormField label="Percentatge pactat (%)" description="Opcional" error={fieldErrors.percentatgePactat}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={percentatgePactat}
                onChange={(event) => setPercentatgePactat(event.target.value)}
              />
            </FormField>
          </div>

          <FormField label="URL del document" description="Opcional" error={fieldErrors.documentUrl}>
            <Input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} />
          </FormField>
        </div>
      )}

      {step === 4 && (
        <ConfirmacioStep
          unitatReferencia={unitatSeleccionada?.referencia ?? unitatId}
          unitatEncaraVacant={unitatEncaraVacant}
          inquilins={inquilinsSeleccionats}
          tipusUs={tipusUs}
          dataInici={dataInici}
          dataFi={dataFi}
          renda={renda}
          fianca={fianca}
        />
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))} disabled={step === 1}>
          Enrere
        </Button>

        {step < 4 ? (
          <Button type="button" onClick={() => setStep((s) => ((s + 1) as Step))} disabled={!canAdvanceFrom(step)}>
            Següent
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              loading={submitting === 'esborrany'}
              onClick={() => handleCreate('esborrany')}
            >
              Crear com a esborrany
            </Button>
            <Button
              type="button"
              loading={submitting === 'actiu'}
              disabled={!unitatEncaraVacant}
              onClick={() => handleCreate('actiu')}
            >
              Crear i activar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface UnitatStepProps {
  propietatId: string;
  setPropietatId: (id: string) => void;
  unitatId: string;
  setUnitatId: (id: string) => void;
}

function UnitatStep({ propietatId, setPropietatId, unitatId, setUnitatId }: UnitatStepProps) {
  const { data: propietats } = useListPropietats({ pageSize: 100 });
  const { data: unitats, isLoading: unitatsLoading } = useUnitatsPropietat(propietatId);
  const unitatsVacants = (unitats ?? []).filter((u) => u.estat === 'vacant');

  return (
    <div className="flex flex-col gap-4">
      <FormField label="Propietat" required>
        <Select value={propietatId} onChange={(event) => setPropietatId(event.target.value)}>
          <option value="">Selecciona una propietat…</option>
          {(propietats?.data ?? []).map((p: Propietat) => (
            <option key={p.id} value={p.id}>
              {p.referencia} — {p.adreca}
            </option>
          ))}
        </Select>
      </FormField>

      {propietatId && (
        <FormField label="Unitat" required description="Només es mostren unitats sense contracte actiu.">
          {unitatsLoading ? (
            <p className="text-sm text-muted-foreground">Carregant unitats…</p>
          ) : unitatsVacants.length === 0 ? (
            <EmptyState title="Aquesta propietat no té unitats vacants." />
          ) : (
            <Select value={unitatId} onChange={(event) => setUnitatId(event.target.value)}>
              <option value="">Selecciona una unitat…</option>
              {unitatsVacants.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.referencia}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}
    </div>
  );
}

interface InquilinsStepProps {
  seleccionats: Inquili[];
  onChange: (inquilins: Inquili[]) => void;
}

function InquilinsStep({ seleccionats, onChange }: InquilinsStepProps) {
  const [q, setQ] = React.useState('');
  const [creantNou, setCreantNou] = React.useState(false);
  const [nomNou, setNomNou] = React.useState('');

  const { data, isLoading } = useListInquilins({ q: q || undefined, pageSize: 10 });
  const createInquili = useCreateInquili();

  const seleccionatsIds = new Set(seleccionats.map((i) => i.id));

  function toggle(inquili: Inquili) {
    if (seleccionatsIds.has(inquili.id)) {
      onChange(seleccionats.filter((i) => i.id !== inquili.id));
    } else {
      onChange([...seleccionats, inquili]);
    }
  }

  async function handleCreateInline() {
    if (!nomNou.trim()) return;
    const inquili = await createInquili.mutateAsync({ nom: nomNou.trim() });
    onChange([...seleccionats, inquili]);
    setNomNou('');
    setCreantNou(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {seleccionats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {seleccionats.map((i) => (
            <span
              key={i.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-accent/50 px-3 py-1 text-xs font-medium"
            >
              {i.nom} {i.cognoms ?? ''}
            </span>
          ))}
        </div>
      )}

      <Input
        placeholder="Cerca un inquilí per nom o NIF…"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        aria-label="Cerca inquilins"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cercant…</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {(data?.data ?? []).map((inquili) => (
            <li key={inquili.id}>
              <label className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-accent/50">
                <Checkbox checked={seleccionatsIds.has(inquili.id)} onChange={() => toggle(inquili)} />
                {inquili.nom} {inquili.cognoms ?? ''} {inquili.nif ? `· ${inquili.nif}` : ''}
              </label>
            </li>
          ))}
        </ul>
      )}

      {creantNou ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Nom de l'inquilí nou"
            value={nomNou}
            onChange={(event) => setNomNou(event.target.value)}
          />
          <Button type="button" size="sm" loading={createInquili.isPending} onClick={handleCreateInline}>
            Crear
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreantNou(false)}>
            Cancel·lar
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setCreantNou(true)}>
          Crear inquilí nou
        </Button>
      )}
    </div>
  );
}

interface ConfirmacioStepProps {
  unitatReferencia: string;
  unitatEncaraVacant: boolean;
  inquilins: Inquili[];
  tipusUs: string;
  dataInici: string;
  dataFi: string;
  renda: string;
  fianca: string;
}

function ConfirmacioStep({
  unitatReferencia,
  unitatEncaraVacant,
  inquilins,
  tipusUs,
  dataInici,
  dataFi,
  renda,
  fianca,
}: ConfirmacioStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
        <SummaryItem label="Unitat" value={unitatReferencia} />
        <SummaryItem
          label="Inquilins"
          value={inquilins.map((i) => `${i.nom} ${i.cognoms ?? ''}`.trim()).join(', ')}
        />
        <SummaryItem label="Tipus d'ús" value={TIPUS_US_OPTIONS.find((o) => o.value === tipusUs)?.label ?? tipusUs} />
        <SummaryItem label="Data inici" value={dataInici} />
        <SummaryItem label="Data fi" value={dataFi || '—'} />
        <SummaryItem label="Renda" value={`${renda} €`} />
        <SummaryItem label="Fiança" value={`${fianca} €`} />
      </dl>

      {!unitatEncaraVacant && (
        <p role="alert" className="text-sm font-medium text-destructive">
          La unitat seleccionada ja no està disponible: un altre usuari l&apos;ha ocupat mentre completaves el
          formulari. Pots crear el contracte com a esborrany, però no activar-lo directament.
        </p>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
