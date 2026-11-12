-- migrations/015_pagaments_marge_venciment.sql
-- Descripció: Marge de 5 dies abans de marcar un pagament com a vençut. Les transferències
--             poden arribar o registrar-se uns dies després del venciment, i un rebut no
--             s'ha de veure vençut per això (docs/requirements.md, regla de negoci #5).
--             El pas a mora no canvia: més de 30 dies des del venciment.
-- Depèn de: 006_pagaments.sql
-- Abast: schema de TENANT — s'executa amb `search_path` apuntant a `tenant_{uuid}`
--        (mai s'executa contra `public`)

BEGIN;

CREATE OR REPLACE FUNCTION marcar_pagaments_vencuts()
RETURNS void AS $$
BEGIN
  UPDATE pagaments
    SET estat = 'vencut'
    WHERE estat IN ('pendent', 'remesa')
      AND data_venciment < current_date - INTERVAL '5 days'
      AND deleted_at IS NULL;

  UPDATE pagaments
    SET estat = 'mora'
    WHERE estat = 'vencut'
      AND data_venciment < current_date - INTERVAL '30 days'
      AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SET search_path FROM CURRENT;

COMMIT;
