export const ESTAT_PAGAMENT_OPTIONS = [
  { value: 'pendent', label: 'Pendent' },
  { value: 'remesa', label: 'En remesa' },
  { value: 'cobrat', label: 'Cobrat' },
  { value: 'vencut', label: 'Vençut' },
  { value: 'mora', label: 'Mora' },
  { value: 'regularitzat', label: 'Regularitzat' },
] as const;

export const METODE_PAGAMENT_OPTIONS = [
  { value: 'domiciliacio', label: 'Domiciliació' },
  { value: 'transferencia', label: 'Transferència' },
  { value: 'efectiu', label: 'Efectiu' },
  { value: 'targeta', label: 'Targeta' },
  { value: 'altres', label: 'Altres' },
] as const;
