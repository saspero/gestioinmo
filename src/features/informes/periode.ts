/** Primer i últim dia de l'any en curs (hora local), en format `YYYY-MM-DD`. */
export function anyEnCurs(ara: Date = new Date()): { inici: string; fi: string } {
  const any = ara.getFullYear();
  return { inici: `${any}-01-01`, fi: `${any}-12-31` };
}

/**
 * Període del dashboard: les dates triades o, si en falta alguna, la de l'any en curs.
 * Així el dashboard mai mostra tot l'historial per descuit.
 */
export function periodeDashboard(
  dataInici: string,
  dataFi: string,
  ara: Date = new Date()
): { dataInici: string; dataFi: string } {
  const perDefecte = anyEnCurs(ara);
  return { dataInici: dataInici || perDefecte.inici, dataFi: dataFi || perDefecte.fi };
}
