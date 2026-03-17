'use client';

import { useEffect } from 'react';
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
import { Button, Separator } from '@nivo/ui';
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
  const { isAuthenticated, userType, tenant, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (userType === 'super-admin') {
      router.replace('/admin');
    }
  }, [isAuthenticated, userType, router]);

  if (!isAuthenticated || userType === 'super-admin') {
    return null;
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary">Nivo</h1>
          <p className="text-xs text-muted-foreground">{tenant?.name || 'Panel de Administración'}</p>
        </div>
        <Separator />
        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <span
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent',
                  pathname === item.href
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
        <Separator />
        <div className="p-4 space-y-2">
          <Link href="/pos">
            <Button className="w-full gap-2" variant="default">
              <ShoppingCart className="h-4 w-4" />
              Abrir Caja POS
            </Button>
          </Link>
          <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
