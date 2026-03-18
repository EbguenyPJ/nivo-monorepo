'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Store, LogOut, Shield, Settings,
  BarChart3, Network, MessageSquare, Search, Bell,
} from 'lucide-react';
import { cn } from '@nivo/ui';
import { useAuthStore } from '@/store/authStore';

const sidebarItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/tenants', icon: Store, label: 'Zapaterías' },
  { href: '#', icon: BarChart3, label: 'Reportes', disabled: true },
  { href: '#', icon: Settings, label: 'Configuración', disabled: true },
  { href: '#', icon: Network, label: 'Integraciones', disabled: true },
  { href: '#', icon: MessageSquare, label: 'Soporte', disabled: true },
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
    <div className="dark flex h-screen bg-background">
      {/* Sidebar — Deep purple dark */}
      <aside className="w-[240px] bg-sidebar flex flex-col border-r border-white/[0.06]">
        {/* Logo */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-orange-400 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <span className="text-white font-black text-lg leading-none">N</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-white tracking-tight">Nivo</h1>
              <p className="text-[10px] text-white/30 font-medium uppercase tracking-widest">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* User Mini Profile */}
        <div className="mx-4 mb-4 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/90 truncate">Super Admin</p>
            <p className="text-[10px] text-white/30">Administrador</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5">
          {sidebarItems.map((item) => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href) && item.href !== '#';
            return (
              <Link
                key={item.label}
                href={item.disabled ? '#' : item.href}
                onClick={(e) => item.disabled && e.preventDefault()}
              >
                <span
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 relative',
                    isActive
                      ? 'bg-gradient-to-r from-purple-500/20 to-fuchsia-500/10 text-white'
                      : item.disabled
                        ? 'text-white/20 cursor-not-allowed'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]',
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-purple-400 to-fuchsia-500" />
                  )}
                  <item.icon className={cn('h-[18px] w-[18px]', isActive && 'text-purple-400')} />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: Sign Out */}
        <div className="p-3 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 border border-transparent hover:border-red-500/10"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-white/[0.06] bg-sidebar/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
              <input
                type="text"
                placeholder="Buscar..."
                className="h-9 w-64 rounded-lg bg-white/[0.04] border border-white/[0.06] pl-9 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.06] transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition-colors relative">
              <Bell className="h-4 w-4 text-white/40" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-400" />
            </button>
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">SA</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
