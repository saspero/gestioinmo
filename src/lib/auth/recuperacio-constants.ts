// Constants de la recuperació de contrasenya, sense dependències de servidor perquè els
// components de client també les puguin importar.

export const MINUTS_VALIDESA_RECUPERACIO = 30;
/** Màxim d'enllaços per usuari i hora: evita fer servir l'app per omplir-li la bústia. */
export const MAX_RECUPERACIONS_PER_HORA = 3;
