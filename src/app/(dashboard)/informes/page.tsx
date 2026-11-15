import Link from 'next/link';
import type { Metadata } from 'next';

import { getModuleAccess } from '@/app/(dashboard)/_lib/session';
import { Forbidden } from '@/app/(dashboard)/_lib/forbidden';
import { PageHeader } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { INFORMES } from '@/lib/validations/informes';

export const metadata: Metadata = { title: 'Informes · Gestinmo' };

export default async function InformesPage() {
  const { allowed } = await getModuleAccess('informes', 'lectura');
  if (!allowed) return <Forbidden />;

  const grups = ['Econòmics', 'Gestió'] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Informes"
        description="Tria un informe per veure'l a la pantalla o descarregar-lo en PDF o CSV."
        breadcrumbs={[{ label: 'Informes' }]}
      />
      {grups.map((grup) => (
        <section key={grup} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{grup}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INFORMES.filter((informe) => informe.grup === grup).map((informe) => (
              <Link key={informe.id} href={`/informes/${informe.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{informe.titol}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{informe.descripcio}</CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
