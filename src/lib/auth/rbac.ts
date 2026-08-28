// Matriu de permisos — còpia fidel de docs/requirements.md §2.2.
// Únic lloc del projecte on viu aquesta taula: si la matriu de requisits canvia,
// només cal actualitzar `PERMISOS`.

export type RolUsuari = 'admin' | 'gestor' | 'comptable';

export type Modul =
  | 'propietats'
  | 'propietaris'
  | 'inquilins'
  | 'contractes'
  | 'pagaments'
  | 'incidencies'
  | 'informes'
  | 'config_tenant';

export type Accio = 'lectura' | 'escriptura';

type NivellAcces = 'T' | 'L' | '-';

const PERMISOS: Record<RolUsuari, Record<Modul, NivellAcces>> = {
  admin: {
    config_tenant: 'T',
    propietats: 'T',
    propietaris: 'T',
    inquilins: 'T',
    contractes: 'T',
    pagaments: 'T',
    incidencies: 'T',
    informes: 'T',
  },
  gestor: {
    config_tenant: '-',
    propietats: 'T',
    propietaris: 'T',
    inquilins: 'T',
    contractes: 'T',
    pagaments: 'T',
    incidencies: 'T',
    informes: 'L',
  },
  comptable: {
    config_tenant: '-',
    propietats: 'L',
    propietaris: 'L',
    inquilins: 'L',
    contractes: 'L',
    pagaments: 'T',
    incidencies: 'L',
    informes: 'T',
  },
};

export function can(rol: RolUsuari, modul: Modul, accio: Accio): boolean {
  const nivell = PERMISOS[rol][modul];
  if (nivell === 'T') return true;
  if (nivell === 'L') return accio === 'lectura';
  return false;
}
