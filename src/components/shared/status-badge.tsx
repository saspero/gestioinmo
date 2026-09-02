import * as React from 'react';
import {
  Circle,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  FileX,
  Info,
  TriangleAlert,
  Wrench,
} from 'lucide-react';

import { cn } from '@/components/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * Tots els ENUMs de `docs/db-schema.md` §4 que es mostren com a estat/etiqueta
 * a la UI. Cada entrada defineix el seu propi conjunt tancat de valors, mai un
 * `string` genèric, perquè un valor d'ENUM que canviï de nom trenqui la
 * compilació en lloc de renderitzar un badge desconegut en producció.
 */
export type EstatUnitat = 'vacant' | 'ocupat' | 'reservat' | 'manteniment' | 'baixa';
export type EstatInquili = 'actiu' | 'moros' | 'inactiu';
export type EstatContracte = 'esborrany' | 'actiu' | 'finalitzat' | 'resolt';
export type EstatPagament = 'pendent' | 'remesa' | 'cobrat' | 'vencut' | 'mora' | 'regularitzat';
export type EstatIncidencia = 'oberta' | 'assignada' | 'en_curs' | 'resolta';
export type PrioritatIncidencia = 'baixa' | 'normal' | 'alta' | 'urgent';

export type StatusBadgeProps =
  | { type: 'unitat'; value: EstatUnitat }
  | { type: 'inquili'; value: EstatInquili }
  | { type: 'contracte'; value: EstatContracte }
  | { type: 'pagament'; value: EstatPagament }
  | { type: 'incidencia'; value: EstatIncidencia }
  | { type: 'prioritat'; value: PrioritatIncidencia };

interface StatusConfigEntry {
  label: string;
  className: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

const unitatConfig: Record<EstatUnitat, StatusConfigEntry> = {
  vacant: { label: 'Vacant', className: 'border-sky-200 bg-sky-50 text-sky-700', icon: Circle },
  ocupat: { label: 'Ocupat', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CircleCheck },
  reservat: { label: 'Reservat', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock },
  manteniment: { label: 'Manteniment', className: 'border-orange-200 bg-orange-50 text-orange-700', icon: Wrench },
  baixa: { label: 'Baixa', className: 'border-slate-200 bg-slate-100 text-slate-600', icon: CircleX },
};

const inquiliConfig: Record<EstatInquili, StatusConfigEntry> = {
  actiu: { label: 'Actiu', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CircleCheck },
  moros: { label: 'Morós', className: 'border-red-200 bg-red-50 text-red-700', icon: TriangleAlert },
  inactiu: { label: 'Inactiu', className: 'border-slate-200 bg-slate-100 text-slate-600', icon: CircleX },
};

const contracteConfig: Record<EstatContracte, StatusConfigEntry> = {
  esborrany: { label: 'Esborrany', className: 'border-slate-200 bg-slate-100 text-slate-600', icon: FileX },
  actiu: { label: 'Actiu', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CircleCheck },
  finalitzat: { label: 'Finalitzat', className: 'border-sky-200 bg-sky-50 text-sky-700', icon: Info },
  resolt: { label: 'Resolt', className: 'border-red-200 bg-red-50 text-red-700', icon: CircleX },
};

const pagamentConfig: Record<EstatPagament, StatusConfigEntry> = {
  pendent: { label: 'Pendent', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock },
  remesa: { label: 'En remesa', className: 'border-sky-200 bg-sky-50 text-sky-700', icon: Info },
  cobrat: { label: 'Cobrat', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CircleCheck },
  vencut: { label: 'Vençut', className: 'border-orange-200 bg-orange-50 text-orange-700', icon: TriangleAlert },
  mora: { label: 'Mora', className: 'border-red-200 bg-red-50 text-red-700', icon: CircleAlert },
  regularitzat: { label: 'Regularitzat', className: 'border-teal-200 bg-teal-50 text-teal-700', icon: CircleCheck },
};

const incidenciaConfig: Record<EstatIncidencia, StatusConfigEntry> = {
  oberta: { label: 'Oberta', className: 'border-red-200 bg-red-50 text-red-700', icon: CircleAlert },
  assignada: { label: 'Assignada', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock },
  en_curs: { label: 'En curs', className: 'border-sky-200 bg-sky-50 text-sky-700', icon: Info },
  resolta: { label: 'Resolta', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CircleCheck },
};

const prioritatConfig: Record<PrioritatIncidencia, StatusConfigEntry> = {
  baixa: { label: 'Baixa', className: 'border-slate-200 bg-slate-100 text-slate-600', icon: Circle },
  normal: { label: 'Normal', className: 'border-sky-200 bg-sky-50 text-sky-700', icon: Circle },
  alta: { label: 'Alta', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: TriangleAlert },
  urgent: { label: 'Urgent', className: 'border-red-200 bg-red-50 text-red-700', icon: CircleAlert },
};

function resolveConfig(props: StatusBadgeProps): StatusConfigEntry {
  switch (props.type) {
    case 'unitat':
      return unitatConfig[props.value];
    case 'inquili':
      return inquiliConfig[props.value];
    case 'contracte':
      return contracteConfig[props.value];
    case 'pagament':
      return pagamentConfig[props.value];
    case 'incidencia':
      return incidenciaConfig[props.value];
    case 'prioritat':
      return prioritatConfig[props.value];
  }
}

/**
 * Badge d'estat/prioritat coherent per a tots els mòduls. El significat mai
 * depèn només del color: sempre porta icona + text (`docs/ux-flows.md` §6).
 */
function StatusBadge({ className, ...props }: StatusBadgeProps & { className?: string }) {
  const { label, className: statusClassName, icon: Icon } = resolveConfig(props);

  return (
    <Badge variant="outline" className={cn(statusClassName, className)}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export { StatusBadge };
