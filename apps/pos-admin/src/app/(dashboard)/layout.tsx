'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MapPin,
  Package,
  BarChart3,
  Users,
  UserCircle,
  Settings,
  ShoppingCart,
  LogOut,
} from 'lucide-react';
import { cn } from '@nivo/ui';
import { useAuthStore } from '@/store/authStore';

const sidebarItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/branches', icon: MapPin, label: 'Sucursales' },
  { href: '/dashboard/inventory', icon: Package, label: 'Inventario' },
  { href: '/dashboard/reports', icon: BarChart3, label: 'Reportes' },
  { href: '/dashboard/employees', icon: Users, label: 'Empleados' },
  { href: '/dashboard/customers', icon: UserCircle, label: 'Clientes' },
  { href: '/dashboard/settings', icon: Settings, label: 'Configuración' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, userType, tenant, user, isImpersonating, _savedImpersonatedTenantId, logout, exitImpersonation } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (userType === 'super-admin') {
      router.replace('/admin');
    }
  }, [isAuthenticated, userType, router, mounted]);

  if (!mounted || !isAuthenticated || userType === 'super-admin') {
    return null;
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleExitImpersonation = () => {
    const tenantId = _savedImpersonatedTenantId;
    exitImpersonation();
    window.location.href = tenantId ? `/admin/tenants/${tenantId}` : '/admin';
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="w-full h-10 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center gap-3 text-sm font-medium text-white z-50 shrink-0">
          <span>Estás navegando como {tenant?.name}.</span>
          <button
            onClick={handleExitImpersonation}
            className="px-3 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors"
          >
            Salir
          </button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Premium Dark Sidebar */}
      <aside className="w-[260px] bg-sidebar flex flex-col">
        {/* Brand */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">Nivo</h1>
              <p className="text-[11px] text-sidebar-foreground/50 font-medium truncate max-w-[140px]">
                {tenant?.name || 'Panel de Administración'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/30">
            Menú
          </p>
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-sidebar-accent/15 text-sidebar-accent shadow-[inset_0_0_0_1px_rgba(96,165,250,0.15)]'
                      : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/[0.04]',
                  )}
                >
                  <item.icon className={cn('h-[18px] w-[18px]', isActive && 'text-sidebar-accent')} />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-3 mt-auto">
          <Link href="/pos">
            <span className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:brightness-110 transition-all duration-200">
              <ShoppingCart className="h-4 w-4" />
              Abrir Caja POS
            </span>
          </Link>

          <div className="rounded-lg bg-white/[0.04] p-3 mt-3 mb-2">
            <p className="text-[11px] font-medium text-sidebar-foreground/40 mb-0.5">Sesión activa</p>
            <p className="text-xs text-sidebar-foreground/70 truncate">{user?.name || user?.email || 'Usuario'}</p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
      </div>
    </div>
  );
}
