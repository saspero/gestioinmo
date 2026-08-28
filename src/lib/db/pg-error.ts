// Tradueix violacions de constraints/triggers de PostgreSQL (docs/db-schema.md §5) a
// missatges llegibles per a un `409 CONFLICT` (docs/agents/AGENT_API.md §5/§8). Si
// l'error no es reconeix, retorna `null` i el handler el tracta com a `500` genèric —
// mai s'exposa el detall intern del driver `pg` al client.

interface PgDriverError {
  code?: string;
  constraint?: string;
  message?: string;
}

// SQLSTATE de conflicte que val la pena traduir a 409 en lloc de deixar caure a 500:
// unique_violation, check_violation, foreign_key_violation, exclusion_violation.
const CONFLICT_CODES = new Set(['23505', '23514', '23503', '23P01']);

// SQLSTATE genèric de `RAISE EXCEPTION` als triggers de negoci (docs/db-schema.md §5):
// el missatge ja el redacta el Database Engineer en català i és directament llegible.
const RAISE_EXCEPTION_CODE = 'P0001';

// Missatges llegibles per constraint conegut, per als casos en què el missatge cru de
// PostgreSQL (unique/check violation) no és presentable a un usuari final.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  contractes_unitat_actiu_idx:
    "Aquesta unitat ja té un contracte actiu. Cal finalitzar-lo o resoldre'l abans d'activar-ne un altre.",
  contractes_check_fianca_habitatge: "Per a contractes d'habitatge, la fiança ha d'estar entre una i dues mensualitats.",
  contractes_check_dates: "La data de fi ha de ser posterior a la data d'inici.",
  persones_nif_hash_actiu_unique: 'Ja existeix una persona activa amb aquest NIF/CIF.',
  persones_estat_inquili_coherent: 'Estat de mora no vàlid per al tipus de persona indicat.',
  propietats_referencia_unique: 'Ja existeix una propietat amb aquesta referència.',
  unitats_propietat_referencia_unique: 'Ja existeix una unitat amb aquesta referència a la mateixa propietat.',
  remeses_referencia_unique: 'Ja existeix una remesa amb aquesta referència.',
  liquidacions_check_periode: "El període de liquidació ha de tenir la data de fi posterior o igual a la d'inici.",
  pagaments_check_cobrament: 'Només es pot informar la data de cobrament en rebuts cobrats o regularitzats.',
};

export function translatePgError(error: unknown): string | null {
  const err = error as PgDriverError;
  if (!err || typeof err !== 'object' || !err.code) return null;

  if (err.code === RAISE_EXCEPTION_CODE && err.message) {
    return err.message;
  }

  if (CONFLICT_CODES.has(err.code)) {
    if (err.constraint && CONSTRAINT_MESSAGES[err.constraint]) {
      return CONSTRAINT_MESSAGES[err.constraint];
    }
    return "L'operació no es pot completar perquè entra en conflicte amb una regla de negoci existent.";
  }

  return null;
}
