import { redirect } from 'next/navigation';

// El dashboard abans vivia a `/informes`. Aquesta ruta queda reservada per a la futura
// pestanya d'informes; mentrestant, els enllaços antics porten al dashboard.
export default function InformesPage() {
  redirect('/dashboard');
}
