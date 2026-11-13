-- migrations/021_contractes_pactes.sql
-- Descripció: Pactes del contracte (docs/requirements.md §3.5):
--             - durada, pròrrogues automàtiques i preavís
--             - tipus d'actualització de la renda (IPC, IRAV, percentatge fix o cap)
--             - moblat i garanties addicionals a la fiança
--             - conceptes que paga l'inquilí (renda i despeses repercutides) amb
--               historial: cada canvi és una fila nova amb la seva data d'efecte.
-- Depèn de: 005_contractes.sql, 008_auditoria.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

DO $$ BEGIN
  CREATE TYPE tipus_actualitzacio AS ENUM ('ipc', 'irav', 'percentatge_fix', 'cap');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipus_garantia AS ENUM ('aval_bancari', 'diposit_addicional', 'asseguranca_impagament', 'altres');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipus_concepte AS ENUM ('renda', 'escombraries', 'comunitat', 'ibi', 'subministraments', 'altres');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE periodicitat_concepte AS ENUM ('mensual', 'anual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- `index_actualitzacio` (text lliure) queda substituït per `tipus_actualitzacio`; es
-- conserva la columna per no trencar dades antigues.
ALTER TABLE contractes
  ADD COLUMN IF NOT EXISTS tipus_actualitzacio tipus_actualitzacio NOT NULL DEFAULT 'ipc',
  ADD COLUMN IF NOT EXISTS durada_mesos        INTEGER CHECK (durada_mesos IS NULL OR durada_mesos > 0),
  ADD COLUMN IF NOT EXISTS prorroga_automatica BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prorroga_mesos      INTEGER CHECK (prorroga_mesos IS NULL OR prorroga_mesos > 0),
  ADD COLUMN IF NOT EXISTS durada_maxima_mesos INTEGER CHECK (durada_maxima_mesos IS NULL OR durada_maxima_mesos > 0),
  ADD COLUMN IF NOT EXISTS preavis_dies        INTEGER CHECK (preavis_dies IS NULL OR preavis_dies >= 0),
  ADD COLUMN IF NOT EXISTS moblat              BOOLEAN NOT NULL DEFAULT false;

UPDATE contractes
   SET tipus_actualitzacio = CASE
         WHEN upper(index_actualitzacio) = 'IRAV' THEN 'irav'::tipus_actualitzacio
         WHEN upper(index_actualitzacio) IN ('CAP', 'SENSE') THEN 'cap'::tipus_actualitzacio
         WHEN upper(index_actualitzacio) <> 'IPC' AND percentatge_pactat IS NOT NULL THEN 'percentatge_fix'::tipus_actualitzacio
         ELSE 'ipc'::tipus_actualitzacio
       END;

CREATE TABLE IF NOT EXISTS contracte_garanties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contracte_id    UUID NOT NULL REFERENCES contractes(id) ON DELETE CASCADE,
  tipus           tipus_garantia NOT NULL,
  import          NUMERIC(10,2) CHECK (import IS NULL OR import >= 0),
  entitat         TEXT,
  data_venciment  DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracte_garanties_contracte ON contracte_garanties (contracte_id);

-- Cada fila és un import vigent entre `vigent_des_de` i `vigent_fins` (inclosos). Un
-- canvi tanca la fila anterior i n'obre una de nova que hi apunta (`substitueix_id`).
-- Una despesa anual es cobra el mes `mes_cobrament`, o repartida en dotze mesos si és nul.
CREATE TABLE IF NOT EXISTS contracte_conceptes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contracte_id    UUID NOT NULL REFERENCES contractes(id) ON DELETE CASCADE,
  tipus           tipus_concepte NOT NULL,
  descripcio      TEXT,
  import          NUMERIC(10,2) NOT NULL CHECK (import > 0),
  periodicitat    periodicitat_concepte NOT NULL DEFAULT 'mensual',
  mes_cobrament   SMALLINT CHECK (mes_cobrament IS NULL OR mes_cobrament BETWEEN 1 AND 12),
  vigent_des_de   DATE NOT NULL,
  vigent_fins     DATE,
  substitueix_id  UUID REFERENCES contracte_conceptes(id) ON DELETE SET NULL,
  motiu           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contracte_conceptes_check_vigencia CHECK (vigent_fins IS NULL OR vigent_fins >= vigent_des_de),
  CONSTRAINT contracte_conceptes_check_mes CHECK (periodicitat = 'anual' OR mes_cobrament IS NULL),
  CONSTRAINT contracte_conceptes_check_renda CHECK (tipus <> 'renda' OR periodicitat = 'mensual')
);

CREATE INDEX IF NOT EXISTS idx_contracte_conceptes_contracte ON contracte_conceptes (contracte_id, vigent_des_de);

-- La renda inicial de cada contracte existent passa a ser el primer concepte.
INSERT INTO contracte_conceptes (contracte_id, tipus, import, vigent_des_de, motiu)
SELECT c.id, 'renda', c.renda, c.data_inici, 'Renda inicial'
  FROM contractes c
 WHERE NOT EXISTS (SELECT 1 FROM contracte_conceptes cc WHERE cc.contracte_id = c.id AND cc.tipus = 'renda');

-- RLS activat sense polítiques: tanca l'accés per l'API de dades de Supabase. L'aplicació
-- es connecta com a propietària de les taules, a qui l'RLS no s'aplica (sense FORCE).
ALTER TABLE contracte_garanties ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracte_conceptes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER trg_auditoria_contracte_garanties
  AFTER INSERT OR UPDATE OR DELETE ON contracte_garanties
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

CREATE OR REPLACE TRIGGER trg_auditoria_contracte_conceptes
  AFTER INSERT OR UPDATE OR DELETE ON contracte_conceptes
  FOR EACH ROW EXECUTE FUNCTION registra_auditoria();

COMMIT;
