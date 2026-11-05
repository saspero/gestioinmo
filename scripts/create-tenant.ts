// Alta d'una agència i del seu primer administrador:
//   npm run tenant:create -- --slug demo --nom "Agència Demo" --email a@b.cat --admin-nom Anna
//
// La contrasenya mai va per argument (quedaria a l'historial): es llegeix de
// TENANT_ADMIN_PASSWORD o, si no hi és, se'n genera una i es mostra un únic cop.

import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { provisionarTenant } from '../src/lib/db/tenants';
import { getDomainPool } from '../src/lib/db/pool';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      slug: { type: 'string' },
      nom: { type: 'string' },
      email: { type: 'string' },
      'admin-nom': { type: 'string' },
      'admin-cognoms': { type: 'string' },
    },
  });

  const generada = !process.env.TENANT_ADMIN_PASSWORD;
  const password = process.env.TENANT_ADMIN_PASSWORD ?? randomBytes(18).toString('base64url');

  const { tenantId, tenantNou } = await provisionarTenant({
    slug: values.slug ?? '',
    nom: values.nom ?? '',
    admin: {
      email: values.email ?? '',
      nom: values['admin-nom'] ?? '',
      cognoms: values['admin-cognoms'],
      password,
    },
  });

  console.log(`${tenantNou ? 'Tenant creat' : 'Tenant existent reutilitzat'}: ${tenantId}`);
  if (generada) console.log(`Contrasenya de l'administrador (no es tornarà a mostrar): ${password}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDomainPool().end());
