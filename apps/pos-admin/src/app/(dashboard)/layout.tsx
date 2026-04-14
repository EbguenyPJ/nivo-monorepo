'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Calculator,
  ClipboardList,
  Package,
  Palette,
  Tag,
  Warehouse,
  ArrowLeftRight,
  PackagePlus,
  Users,
  Heart,
  Wallet,
  UserCog,
  MapPin,
  BarChart3,
  TrendingUp,
  Settings,
  Plug,
  CreditCard,
  HelpCircle,
  ShoppingCart,
  LogOut,
  ChevronDown,
  Search,
  Bell,
  Plus,
  UserCircle,
  Command,
  X,
  User,
  Sliders,
  DollarSign,
  Globe,
  Truck,
  ClipboardCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@nivo/ui';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore, GENERAL_BRANCH_ID } from '@/store/branchStore';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Sidebar Config
// ---------------------------------------------------------------------------

interface SidebarItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** 'general' = only in General mode, 'branch' = only in Branch mode, undefined = always */
  visibleIn?: 'general' | 'branch';
  /** Dynamic badge key — will be filled at runtime */
  badgeKey?: string;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { href: '/dashboard/sales', icon: Receipt, label: 'Historial de Ventas' },
      { href: '/dashboard/cash-register', icon: Calculator, label: 'Arqueos y Cortes' },
      { href: '/dashboard/layaways', icon: ClipboardList, label: 'Apartados', visibleIn: 'branch' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { href: '/dashboard/products', icon: Package, label: 'Modelos de Zapatos' },
      { href: '/dashboard/brands', icon: Tag, label: 'Marcas' },
      { href: '/dashboard/collections', icon: Palette, label: 'Colecciones' },
    ],
  },
  {
    label: 'Inventario',
    items: [
      { href: '/dashboard/storage-locations', icon: MapPin, label: 'Ubicaciones' },
      { href: '/dashboard/inventory', icon: Warehouse, label: 'Stock por Sucursal' },
      { href: '/dashboard/transfers', icon: ArrowLeftRight, label: 'Traspasos', badgeKey: 'transfers_incoming' },
      { href: '/dashboard/stock-movements', icon: PackagePlus, label: 'Entradas y Salidas' },
      { href: '/dashboard/audits', icon: ClipboardCheck, label: 'Auditorías de Stock' },
    ],
  },
  {
    label: 'Compras',
    items: [
      { href: '/dashboard/purchases', icon: Truck, label: 'Órdenes de Compra' },
    ],
  },
  {
    label: 'Clientes',
    items: [
      { href: '/dashboard/customers', icon: Users, label: 'Directorio' },
      { href: '/dashboard/loyalty', icon: Heart, label: 'Programa de Lealtad' },
      { href: '/dashboard/accounts', icon: Receipt, label: 'Cuentas por Cobrar' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { href: '/dashboard/expenses', icon: Wallet, label: 'Control de Gastos' },
      { href: '/dashboard/employees', icon: UserCog, label: 'Equipo y Seguridad' },
      { href: '/dashboard/branches', icon: MapPin, label: 'Sucursales' },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { href: '/dashboard/reports', icon: BarChart3, label: 'Reportes de Ventas' },
      { href: '/dashboard/profitability', icon: DollarSign, label: 'Rentabilidad' },
      { href: '/dashboard/analytics', icon: TrendingUp, label: 'Rendimiento' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/dashboard/settings', icon: Settings, label: 'Configuración' },
      { href: '/dashboard/settings/catalogs', icon: Sliders, label: 'Catálogos' },
      { href: '/dashboard/integrations', icon: Plug, label: 'Integraciones' },
      { href: '/dashboard/subscription', icon: CreditCard, label: 'Mi Suscripción' },
      { href: '/dashboard/support', icon: HelpCircle, label: 'Soporte Nivo' },
    ],
  },
];

/** Filter sidebar items based on branch context */
function getFilteredSidebarGroups(isGeneral: boolean): SidebarGroup[] {
  const mode = isGeneral ? 'general' : 'branch';
  return sidebarGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !item.visibleIn || item.visibleIn === mode),
    }))
    .filter((g) => g.items.length > 0);
}

// Flatten for omnisearch (show all regardless of context)
const allNavItems = sidebarGroups.flatMap((g) =>
  g.items.map((item) => ({ ...item, group: g.label }))
);

// Quick actions
const quickActions = [
  { label: 'Nueva Venta', icon: ShoppingCart, href: '/pos' },
  { label: 'Nuevo Cliente', icon: UserCircle, href: '/dashboard/customers' },
  { label: 'Nuevo Gasto', icon: DollarSign, href: '/dashboard/expenses' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, userType, tenant, user, isImpersonating, _savedImpersonatedTenantId, logout, exitImpersonation } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sidebarGroups.forEach((g) => { initial[g.label] = g.label !== 'Principal'; });
    return initial;
  });

  // Top bar states
  const [omnisearchOpen, setOmnisearchOpen] = useState(false);
  const [omnisearchQuery, setOmnisearchQuery] = useState('');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [branchSelectorOpen, setBranchSelectorOpen] = useState(false);
  const { branches: branchesList, selectedBranchId, selectedBranchName: selectedBranch, isGeneralSelected, fetchBranches, selectBranch, selectGeneral } = useBranchStore();

  // Refs for outside click
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);
  const omnisearchInputRef = useRef<HTMLInputElement>(null);

  // ---- Mount + Theme ----
  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add('tenant-dark');
    return () => {
      document.documentElement.classList.remove('tenant-light', 'tenant-dark');
    };
  }, []);

  // ---- Auth guard ----
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (userType === 'super-admin' && !isImpersonating) {
      router.replace('/admin');
    }
  }, [isAuthenticated, userType, router, mounted, isImpersonating]);

  // ---- Fetch branches for selector ----
  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    fetchBranches();
  }, [mounted, isAuthenticated]);

  // ---- Sidebar badges (e.g. pending incoming transfers) ----
  const [sidebarBadges, setSidebarBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!mounted || !isAuthenticated || !selectedBranchId || isGeneralSelected) return;
    apiClient.get('/products/inventory/transfers/count-incoming', { params: { branch_id: selectedBranchId } })
      .then((res) => {
        const count = typeof res.data === 'number' ? res.data : 0;
        setSidebarBadges((prev) => ({ ...prev, transfers_incoming: count }));
      })
      .catch(() => {});
  }, [mounted, isAuthenticated, selectedBranchId, isGeneralSelected]);

  // ---- Keyboard shortcut Cmd+K ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOmnisearchOpen((prev) => !prev);
        setOmnisearchQuery('');
      }
      if (e.key === 'Escape') {
        setOmnisearchOpen(false);
        setQuickActionsOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
        setBranchSelectorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus omnisearch input when opened
  useEffect(() => {
    if (omnisearchOpen) {
      setTimeout(() => omnisearchInputRef.current?.focus(), 50);
    }
  }, [omnisearchOpen]);

  // ---- Close dropdowns on outside click ----
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) setQuickActionsOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setNotificationsOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) setBranchSelectorOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!mounted || !isAuthenticated || (userType === 'super-admin' && !isImpersonating)) {
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

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isItemActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    // Exact match first, then prefix match — but only if no other sidebar item is a better (longer) match
    if (pathname === href) return true;
    if (pathname.startsWith(href + '/')) {
      // Check if there's a more specific sidebar item that matches
      const hasMoreSpecific = allNavItems.some(
        (item) => item.href !== href && item.href.startsWith(href + '/') && (pathname === item.href || pathname.startsWith(item.href + '/'))
      );
      return !hasMoreSpecific;
    }
    return false;
  };

  const userInitials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || 'U').toUpperCase();

  // Omnisearch filtered results
  const omnisearchResults = omnisearchQuery.trim()
    ? allNavItems.filter(
        (item) =>
          item.label.toLowerCase().includes(omnisearchQuery.toLowerCase()) ||
          item.group.toLowerCase().includes(omnisearchQuery.toLowerCase())
      )
    : allNavItems.slice(0, 8);

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
        {/* ================================================================ */}
        {/* SIDEBAR                                                          */}
        {/* ================================================================ */}
        <aside className="w-[260px] bg-[hsl(var(--sidebar))] flex flex-col shrink-0 border-r border-white/[0.06]">
          {/* Brand */}
          <Link href="/dashboard" className="block px-5 py-5 shrink-0 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))] flex items-center justify-center shadow-lg">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-[hsl(var(--sidebar-foreground))] tracking-tight truncate">
                  {tenant?.name || 'Nivo'}
                </h1>
                <p className="text-[11px] text-[hsl(var(--sidebar-foreground))]/50 font-medium truncate">
                  {tenant?.subdomain ? `${tenant.subdomain}.nivo.mx` : 'Panel de Administración'}
                </p>
              </div>
            </div>
          </Link>

          {/* Navigation — scrollable */}
          <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
            {getFilteredSidebarGroups(isGeneralSelected).map((group) => {
              const isCollapsed = collapsedGroups[group.label] ?? false;
              return (
                <div key={group.label} className="mb-0.5">
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--sidebar-foreground))]/30 hover:text-[hsl(var(--sidebar-foreground))]/50 transition-colors"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 transition-transform duration-200',
                        isCollapsed && '-rotate-90'
                      )}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = isItemActive(item.href);
                        return (
                          <Link key={item.href} href={item.href}>
                            <span
                              className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200',
                                active
                                  ? 'bg-[hsl(var(--sidebar-accent))]/15 text-[hsl(var(--sidebar-accent))] shadow-[inset_0_0_0_1px_hsl(var(--sidebar-accent)/0.15)]'
                                  : 'text-[hsl(var(--sidebar-foreground))]/60 hover:text-[hsl(var(--sidebar-foreground))] hover:bg-white/[0.04]'
                              )}
                            >
                              <item.icon
                                className={cn(
                                  'h-[17px] w-[17px] shrink-0',
                                  active && 'text-[hsl(var(--sidebar-accent))]'
                                )}
                              />
                              <span className="flex-1">{item.label}</span>
                              {item.badgeKey && sidebarBadges[item.badgeKey] > 0 && (
                                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                  {sidebarBadges[item.badgeKey]}
                                </span>
                              )}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* POS Button — Bottom, the star of the sidebar */}
          <div className="p-3 shrink-0">
            {isGeneralSelected ? (
              <div
                title="Selecciona una sucursal para abrir caja"
                className="flex items-center justify-center gap-2.5 rounded-xl bg-muted px-4 py-3.5 text-sm font-bold text-muted-foreground cursor-not-allowed opacity-60"
              >
                <ShoppingCart className="h-5 w-5" />
                Abrir Caja POS
              </div>
            ) : (
              <Link href="/pos">
                <span className="flex items-center justify-center gap-2.5 rounded-xl bg-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]/20 hover:shadow-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]/40 hover:brightness-110 transition-all duration-200">
                  <ShoppingCart className="h-5 w-5" />
                  Abrir Caja POS
                </span>
              </Link>
            )}
          </div>
        </aside>

        {/* ================================================================ */}
        {/* RIGHT AREA: Top Bar + Content                                    */}
        {/* ================================================================ */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* ============================================================== */}
          {/* TOP BAR                                                        */}
          {/* ============================================================== */}
          <header className="h-14 shrink-0 border-b border-border bg-card/50 backdrop-blur-xl flex items-center px-5 gap-4 z-40">
            {/* LEFT: Omnisearch Trigger */}
            <button
              onClick={() => { setOmnisearchOpen(true); setOmnisearchQuery(''); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors text-muted-foreground text-sm flex-1 max-w-md"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="truncate">Buscar productos, clientes, módulos...</span>
              <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
                <Command className="h-3 w-3" />K
              </kbd>
            </button>

            {/* CENTER: Branch Selector (role-aware) */}
            {user?.role === 'cashier' ? (
              /* Cashier: read-only badge */
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-sm">
                <MapPin className="h-4 w-4 text-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]" />
                <span className="text-foreground font-medium truncate max-w-[160px]">{selectedBranch}</span>
              </div>
            ) : (
              /* Admin/Manager: interactive dropdown */
              <div ref={branchRef} className="relative">
                <button
                  onClick={() => setBranchSelectorOpen(!branchSelectorOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-sm"
                >
                  {isGeneralSelected ? (
                    <Globe className="h-4 w-4 text-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]" />
                  ) : (
                    <MapPin className="h-4 w-4 text-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]" />
                  )}
                  <span className="text-foreground font-medium truncate max-w-[160px]">{selectedBranch}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {branchSelectorOpen && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-60 rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-xl p-1.5 z-50">
                    {/* General option */}
                    <button
                      onClick={() => { selectGeneral(); setBranchSelectorOpen(false); }}
                      className={cn(
                        'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left',
                        isGeneralSelected
                          ? 'bg-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]/10 text-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))] font-medium'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">General (Todas)</span>
                    </button>
                    <div className="mx-2 my-1 border-t border-border" />
                    <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sucursales</p>
                    {branchesList.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Sin sucursales</p>
                    ) : (
                      branchesList.map((branch) => (
                        <button
                          key={branch.id}
                          onClick={() => { selectBranch(branch.id); setBranchSelectorOpen(false); }}
                          className={cn(
                            'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors text-left',
                            selectedBranchId === branch.id
                              ? 'bg-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]/10 text-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))] font-medium'
                              : 'text-foreground hover:bg-muted'
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{branch.name}</span>
                          {!branch.is_active && (
                            <span className="ml-auto text-[10px] text-muted-foreground bg-muted rounded px-1">Cerrada</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1" />

            {/* RIGHT: Quick Actions */}
            <div ref={quickActionsRef} className="relative">
              <button
                onClick={() => { setQuickActionsOpen(!quickActionsOpen); setNotificationsOpen(false); setProfileOpen(false); }}
                className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors"
                title="Acciones rápidas"
              >
                <Plus className="h-4 w-4 text-foreground" />
              </button>
              {quickActionsOpen && (
                <div className="absolute top-full right-0 mt-2 w-52 rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-xl p-1.5 z-50">
                  <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Acciones rápidas</p>
                  {quickActions.map((action) => {
                    const disabled = isGeneralSelected && action.href === '/pos';
                    return (
                      <button
                        key={action.label}
                        onClick={() => { if (!disabled) { router.push(action.href); setQuickActionsOpen(false); } }}
                        className={cn(
                          'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left',
                          disabled ? 'text-muted-foreground opacity-50 cursor-not-allowed' : 'text-foreground hover:bg-muted'
                        )}
                        title={disabled ? 'Selecciona una sucursal para abrir caja' : undefined}
                      >
                        <action.icon className="h-4 w-4 text-muted-foreground" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div ref={notificationsRef} className="relative">
              <button
                onClick={() => { setNotificationsOpen(!notificationsOpen); setQuickActionsOpen(false); setProfileOpen(false); }}
                className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors relative"
                title="Notificaciones"
              >
                <Bell className="h-4 w-4 text-foreground" />
                {/* Notification dot */}
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))] border-2 border-card" />
              </button>
              {notificationsOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-xl z-50">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
                  </div>
                  <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                    {[
                      { title: 'Stock bajo', desc: 'Nike Air Max talla 26 — quedan 2 pares', time: 'hace 15 min', type: 'warning' },
                      { title: 'Nuevo pedido', desc: 'Pedido #1042 recibido para entrega a domicilio', time: 'hace 1h', type: 'info' },
                      { title: 'Traspaso completado', desc: '10 pares transferidos a Sucursal Norte', time: 'hace 3h', type: 'success' },
                    ].map((n, i) => (
                      <div key={i} className="rounded-lg bg-muted/50 p-3 hover:bg-muted transition-colors cursor-pointer">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">{n.title}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{n.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t border-border">
                    <button className="w-full text-center text-xs text-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))] font-medium hover:underline py-1">
                      Ver todas las notificaciones
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Help */}
            <button
              onClick={() => router.push('/dashboard/support')}
              className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors"
              title="Soporte y ayuda"
            >
              <HelpCircle className="h-4 w-4 text-foreground" />
            </button>

            {/* Profile Avatar */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => { setProfileOpen(!profileOpen); setQuickActionsOpen(false); setNotificationsOpen(false); }}
                className="h-9 w-9 rounded-full bg-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]/20 hover:bg-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]/30 flex items-center justify-center text-xs font-bold text-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))] transition-colors ring-2 ring-transparent hover:ring-[hsl(var(--color-primary-h),var(--color-primary-s),var(--color-primary-l))]/20"
                title="Mi perfil"
              >
                {userInitials}
              </button>
              {profileOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-xl z-50">
                  {/* User info header */}
                  <div className="p-4 border-b border-border">
                    <p className="text-sm font-semibold text-foreground truncate">{user?.name || user?.email || 'Usuario'}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email || ''}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { router.push('/dashboard/settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      Mi Perfil
                    </button>
                    <button
                      onClick={() => { router.push('/dashboard/settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <Sliders className="h-4 w-4 text-muted-foreground" />
                      Preferencias
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={() => { handleLogout(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* ============================================================== */}
          {/* MAIN CONTENT                                                   */}
          {/* ============================================================== */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-8 py-7">{children}</div>
          </main>
        </div>
      </div>

      {/* ================================================================== */}
      {/* OMNISEARCH MODAL (Cmd+K)                                           */}
      {/* ================================================================== */}
      {omnisearchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOmnisearchOpen(false)}
          />
          {/* Modal */}
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                ref={omnisearchInputRef}
                type="text"
                placeholder="Buscar módulos, productos, clientes..."
                className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground outline-none"
                value={omnisearchQuery}
                onChange={(e) => setOmnisearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && omnisearchResults.length > 0) {
                    router.push(omnisearchResults[0].href);
                    setOmnisearchOpen(false);
                  }
                }}
              />
              <button onClick={() => setOmnisearchOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto p-2">
              {omnisearchQuery.trim() && omnisearchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No se encontraron resultados</p>
              ) : (
                <>
                  {!omnisearchQuery.trim() && (
                    <p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Accesos rápidos</p>
                  )}
                  {omnisearchResults.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => { router.push(item.href); setOmnisearchOpen(false); }}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.group}</p>
                      </div>
                      {!omnisearchQuery.trim() && (
                        <span className="text-[10px] text-muted-foreground/50">Ir</span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-card px-1 py-0.5 text-[10px] font-mono">↵</kbd> Abrir
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-card px-1 py-0.5 text-[10px] font-mono">Esc</kbd> Cerrar
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
