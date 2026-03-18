'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Store, LogOut, Shield } from 'lucide-react';
import { cn } from '@nivo/ui';
import { useAuthStore } from '@/store/authStore';

const sidebarItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/tenants', icon: Store, label: 'Zapaterías' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, userType, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated || userType !== 'super-admin') {
      router.replace('/login');
    }
  }, [isAuthenticated, userType, router, mounted]);

  if (!mounted || !isAuthenticated || userType !== 'super-admin') {
    return null;
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Premium Dark Sidebar */}
      <aside className="w-[260px] bg-sidebar flex flex-col">
        {/* Brand */}
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">Nivo</h1>
              <p className="text-[11px] text-sidebar-foreground/50 font-medium">Super Admin</p>
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
          <div className="rounded-lg bg-white/[0.04] p-3 mb-3">
            <p className="text-[11px] font-medium text-sidebar-foreground/40 mb-1">Sesión activa</p>
            <p className="text-xs text-sidebar-foreground/70 truncate">Administrador del Sistema</p>
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
  );
}
