'use client';

// Client Component perquè la ruta activa surt de `usePathname()` i perquè ni les icones
// (funcions) ni un `onLogout` que rep un esdeveniment poden creuar la frontera des del
// Server Component `layout.tsx`.

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Building2,
  FileText,
  Receipt,
  Settings,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

import { AppShell } from '@/components/shared/app-shell';
import type { NavItem } from '@/components/shared/nav-menu';
import { logoutAction } from '@/features/auth/actions';
import { can, type Modul, type RolUsuari } from '@/lib/auth/rbac';

const NAVEGACIO: Array<NavItem & { modul: Modul }> = [
  { label: 'Informes', href: '/informes', modul: 'informes', icon: BarChart3 },
  { label: 'Propietats', href: '/propietats', modul: 'propietats', icon: Building2 },
  { label: 'Propietaris', href: '/propietaris', modul: 'propietaris', icon: UserRound },
  { label: 'Inquilins', href: '/inquilins', modul: 'inquilins', icon: Users },
  { label: 'Contractes', href: '/contractes', modul: 'contractes', icon: FileText },
  { label: 'Pagaments', href: '/pagaments', modul: 'pagaments', icon: Wallet },
  { label: 'Despeses', href: '/despeses', modul: 'despeses', icon: Receipt },
  { label: 'Incidències', href: '/incidencies', modul: 'incidencies', icon: Wrench },
  { label: 'Configuració', href: '/configuracio', modul: 'config_tenant', icon: Settings },
];

const ETIQUETES_ROL: Record<RolUsuari, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  comptable: 'Comptable',
};

interface DashboardShellProps {
  tenantName: string;
  userName: string;
  rol: RolUsuari;
  children: React.ReactNode;
}

export function DashboardShell({ tenantName, userName, rol, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const navItems = NAVEGACIO.filter((item) => can(rol, item.modul, 'lectura'));
  const activeHref = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;

  return (
    <AppShell
      tenantName={tenantName}
      navItems={navItems}
      activeHref={activeHref}
      user={{ name: userName, roleLabel: ETIQUETES_ROL[rol] }}
      onLogout={() => startTransition(() => logoutAction())}
      onAccount={() => router.push('/compte')}
    >
      {children}
    </AppShell>
  );
}
