'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Store, LogOut, Shield, Settings,
  BarChart3, Network, MessageSquare, Search, Bell,
  User, Moon, Sun, ChevronDown, Check, X,
  UserPlus, CreditCard, AlertTriangle, Ban, CheckCircle2,
  TrendingUp, Zap, Eye, EyeOff, Globe, Palette, Monitor,
  Lock, Mail, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import {
  cn, Badge, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@nivo/ui';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api';

// Notification type icons
const NOTIF_ICONS: Record<string, { icon: typeof Store; color: string }> = {
  tenant_registered: { icon: UserPlus, color: 'text-purple-400' },
  payment_failed: { icon: AlertTriangle, color: 'text-red-400' },
  subscription_canceled: { icon: X, color: 'text-red-400' },
  subscription_upgraded: { icon: TrendingUp, color: 'text-fuchsia-400' },
  tenant_suspended: { icon: Ban, color: 'text-orange-400' },
  tenant_activated: { icon: CheckCircle2, color: 'text-emerald-400' },
  system_alert: { icon: Zap, color: 'text-amber-400' },
};

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  tenant_name: string | null;
  is_read: boolean;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

const sidebarItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/tenants', icon: Store, label: 'Zapaterías' },
  { href: '/admin/reports', icon: BarChart3, label: 'Reportes' },
  { href: '/admin/settings', icon: Settings, label: 'Configuración' },
  { href: '/admin/integrations', icon: Network, label: 'Integraciones' },
  { href: '/admin/support', icon: MessageSquare, label: 'Soporte' },
];

// Omnisearch result types
interface OmniResult {
  id: string;
  type: 'tenant' | 'nav' | 'action';
  title: string;
  subtitle?: string;
  icon: typeof Store;
  iconColor?: string;
  href?: string;
  action?: () => void;
}

const NAV_ITEMS: OmniResult[] = [
  { id: 'nav-dashboard', type: 'nav', title: 'Dashboard', subtitle: 'Vista general de la plataforma', icon: LayoutDashboard, iconColor: 'text-purple-400', href: '/admin' },
  { id: 'nav-tenants', type: 'nav', title: 'Zapaterías', subtitle: 'Gestionar todos los tenants', icon: Store, iconColor: 'text-fuchsia-400', href: '/admin/tenants' },
  { id: 'nav-reports', type: 'nav', title: 'Reportes', subtitle: 'MRR, retención, ingresos y exportación', icon: BarChart3, iconColor: 'text-amber-400', href: '/admin/reports' },
  { id: 'nav-settings', type: 'nav', title: 'Configuración', subtitle: 'Planes, límites y API keys', icon: Settings, iconColor: 'text-emerald-400', href: '/admin/settings' },
  { id: 'nav-integrations', type: 'nav', title: 'Integraciones', subtitle: 'Slack, Discord, SendGrid, webhooks', icon: Network, iconColor: 'text-blue-400', href: '/admin/integrations' },
  { id: 'nav-support', type: 'nav', title: 'Soporte', subtitle: 'Tickets de ayuda de zapaterías', icon: MessageSquare, iconColor: 'text-orange-400', href: '/admin/support' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, userType, user, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Theme state
  const [isDark, setIsDark] = useState(true);

  // Compact sidebar state
  const [compactSidebar, setCompactSidebar] = useState(false);

  // Omnisearch state
  const [omniOpen, setOmniOpen] = useState(false);
  const [omniQuery, setOmniQuery] = useState('');
  const [omniResults, setOmniResults] = useState<OmniResult[]>([]);
  const [omniLoading, setOmniLoading] = useState(false);
  const [omniSelected, setOmniSelected] = useState(0);
  const omniInputRef = useRef<HTMLInputElement>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Profile dropdown state
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Mi Perfil dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwChanging, setPwChanging] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preferencias dialog state
  const [prefsDialogOpen, setPrefsDialogOpen] = useState(false);
  const [prefAnimations, setPrefAnimations] = useState(true);
  const [prefLanguage, setPrefLanguage] = useState('es');

  // Load theme & preferences from localStorage
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('nivo-admin-theme');
    if (savedTheme === 'light') setIsDark(false);
    else setIsDark(true);

    const savedPrefs = localStorage.getItem('nivo-admin-prefs');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        setCompactSidebar(prefs.compactSidebar ?? false);
        setPrefAnimations(prefs.animations ?? true);
        setPrefLanguage(prefs.language ?? 'es');
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated || userType !== 'super-admin') {
      router.replace('/login');
    }
  }, [isAuthenticated, userType, router, mounted]);

  // Sync theme class on <html> so Radix portals (Dialog, Select, Dropdown) inherit CSS vars
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark', 'light-admin');
    html.classList.add(isDark ? 'dark' : 'light-admin');
    return () => {
      html.classList.remove('dark', 'light-admin');
    };
  }, [isDark]);

  // Toggle theme
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('nivo-admin-theme', next ? 'dark' : 'light');
  };

  // Toggle compact sidebar
  const toggleCompactSidebar = () => {
    const next = !compactSidebar;
    setCompactSidebar(next);
    const savedPrefs = localStorage.getItem('nivo-admin-prefs');
    const prefs = savedPrefs ? JSON.parse(savedPrefs) : {};
    prefs.compactSidebar = next;
    localStorage.setItem('nivo-admin-prefs', JSON.stringify(prefs));
  };

  // Save preferences
  const savePreferences = () => {
    const prefs = {
      compactSidebar,
      animations: prefAnimations,
      language: prefLanguage,
    };
    localStorage.setItem('nivo-admin-prefs', JSON.stringify(prefs));
    setPrefsDialogOpen(false);
  };

  // ====== Omnisearch ======
  // ⌘K / Ctrl+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOmniOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && omniOpen) {
        setOmniOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [omniOpen]);

  // Focus input when omnisearch opens
  useEffect(() => {
    if (omniOpen) {
      setOmniQuery('');
      setOmniResults([]);
      setOmniSelected(0);
      setTimeout(() => omniInputRef.current?.focus(), 50);
    }
  }, [omniOpen]);

  // Debounced search
  useEffect(() => {
    if (!omniOpen) return;

    // Filter nav items locally
    const q = omniQuery.toLowerCase().trim();
    const filteredNav = q
      ? NAV_ITEMS.filter((n) => n.title.toLowerCase().includes(q) || n.subtitle?.toLowerCase().includes(q))
      : NAV_ITEMS;

    if (!q) {
      setOmniResults(filteredNav);
      setOmniLoading(false);
      return;
    }

    // Search tenants via API with debounce
    setOmniLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/tenants?search=${encodeURIComponent(q)}&limit=6&page=1`);
        const tenants = (res.data.data || []).map((t: any) => ({
          id: `tenant-${t.id}`,
          type: 'tenant' as const,
          title: t.name,
          subtitle: `${t.subdomain}.nivo.com${t.is_active ? '' : ' — Suspendida'}`,
          icon: Store,
          iconColor: t.is_active ? 'text-purple-400' : 'text-red-400',
          href: `/admin/tenants/${t.id}`,
        }));
        setOmniResults([...tenants, ...filteredNav]);
      } catch {
        setOmniResults(filteredNav);
      } finally {
        setOmniLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [omniQuery, omniOpen]);

  // Keyboard navigation in omnisearch
  const handleOmniKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOmniSelected((prev) => Math.min(prev + 1, omniResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOmniSelected((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && omniResults[omniSelected]) {
      e.preventDefault();
      const result = omniResults[omniSelected];
      setOmniOpen(false);
      if (result.href && result.href !== '#') {
        router.push(result.href);
      } else if (result.action) {
        result.action();
      }
    }
  };

  const executeOmniResult = (result: OmniResult) => {
    setOmniOpen(false);
    if (result.href && result.href !== '#') {
      router.push(result.href);
    } else if (result.action) {
      result.action();
    }
  };

  // Fetch unread count on mount and every 30s
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications/unread-count');
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [mounted, isAuthenticated, fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await apiClient.get('/notifications?limit=15');
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // Silently fail
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const toggleNotifications = () => {
    if (!notifOpen) {
      fetchNotifications();
    }
    setNotifOpen(!notifOpen);
    setProfileOpen(false);
  };

  const markAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Change password handler
  const handleChangePassword = async () => {
    setPwMessage(null);
    if (!currentPassword || !newPassword) {
      setPwMessage({ type: 'error', text: 'Todos los campos son obligatorios' });
      return;
    }
    if (newPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }
    setPwChanging(true);
    try {
      await apiClient.patch('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error al cambiar la contraseña';
      setPwMessage({ type: 'error', text: msg });
    } finally {
      setPwChanging(false);
    }
  };

  if (!mounted || !isAuthenticated || userType !== 'super-admin') {
    return null;
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const userEmail = user?.email || 'admin@nivo.com';
  const userInitials = userEmail.substring(0, 2).toUpperCase();

  // Dynamic color helpers based on theme
  const t = {
    // Sidebar
    sidebarBg: isDark ? 'bg-[hsl(252,35%,5%)]' : 'bg-[hsl(252,30%,18%)]',
    sidebarBorder: isDark ? 'border-white/[0.06]' : 'border-[hsl(252,20%,25%)]',
    // Topbar
    topbarBg: isDark ? 'bg-[hsl(252,35%,5%)]/50' : 'bg-white/80',
    topbarBorder: isDark ? 'border-white/[0.06]' : 'border-gray-200',
    // Search input
    searchBg: isDark ? 'bg-white/[0.04]' : 'bg-gray-100',
    searchBorder: isDark ? 'border-white/[0.06]' : 'border-gray-200',
    searchText: isDark ? 'text-white' : 'text-gray-900',
    searchPlaceholder: isDark ? 'placeholder:text-white/20' : 'placeholder:text-gray-400',
    searchIcon: isDark ? 'text-white/20' : 'text-gray-400',
    searchFocusBorder: isDark ? 'focus:border-purple-500/40' : 'focus:border-purple-400',
    searchFocusBg: isDark ? 'focus:bg-white/[0.06]' : 'focus:bg-white',
    // Buttons (bell, avatar)
    btnBg: isDark ? 'bg-white/[0.04]' : 'bg-gray-100',
    btnBorder: isDark ? 'border-white/[0.06]' : 'border-gray-200',
    btnHover: isDark ? 'hover:bg-white/[0.08]' : 'hover:bg-gray-200',
    btnActiveBg: isDark ? 'bg-white/[0.08]' : 'bg-purple-50',
    btnActiveBorder: isDark ? 'border-purple-500/30' : 'border-purple-300',
    btnIcon: isDark ? 'text-white/40' : 'text-gray-500',
    // Dropdown
    dropdownBg: isDark ? 'bg-[#1a1530]' : 'bg-white',
    dropdownBorder: isDark ? 'border-white/[0.08]' : 'border-gray-200',
    dropdownShadow: isDark ? 'shadow-black/40' : 'shadow-gray-300/50',
    dropdownDivider: isDark ? 'border-white/[0.06]' : 'border-gray-100',
    // Text variants
    textPrimary: isDark ? 'text-white/90' : 'text-gray-900',
    textSecondary: isDark ? 'text-white/50' : 'text-gray-500',
    textMuted: isDark ? 'text-white/30' : 'text-gray-400',
    textLink: isDark ? 'text-white/40' : 'text-gray-400',
    // Notification-specific
    notifBg: isDark ? 'bg-purple-500/[0.04]' : 'bg-purple-50',
    notifHover: isDark ? 'hover:bg-purple-500/[0.08]' : 'hover:bg-purple-50/80',
    notifReadHover: isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50',
    notifReadText: isDark ? 'text-white/40' : 'text-gray-400',
    notifUnreadText: isDark ? 'text-white/80' : 'text-gray-800',
    notifTime: isDark ? 'text-white/20' : 'text-gray-400',
    notifItemBorder: isDark ? 'border-white/[0.03]' : 'border-gray-100',
    notifEmptyIcon: isDark ? 'text-white/10' : 'text-gray-200',
    notifEmptyText: isDark ? 'text-white/25' : 'text-gray-400',
    // Menu items
    menuText: isDark ? 'text-white/50 hover:text-white/80' : 'text-gray-600 hover:text-gray-900',
    menuHover: isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50',
    // Theme toggle
    toggleBgOn: isDark ? 'bg-purple-500/30 border-purple-500/40' : 'bg-purple-100 border-purple-300',
    toggleBgOff: isDark ? 'bg-white/10 border-white/20' : 'bg-gray-200 border-gray-300',
    toggleDotOn: isDark ? 'bg-purple-400 shadow-purple-500/50' : 'bg-purple-500 shadow-purple-300/50',
    toggleDotOff: isDark ? 'bg-white/60' : 'bg-gray-400',
    // Chevron
    chevron: isDark ? 'text-white/30' : 'text-gray-400',
    // Main content
    contentBg: isDark ? 'bg-background' : 'bg-[hsl(250,20%,97%)]',
    // Sidebar glass card
    sidebarGlass: isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-white/[0.08] border-white/[0.1]',
    // Sidebar nav
    navActive: isDark
      ? 'bg-gradient-to-r from-purple-500/20 to-fuchsia-500/10 text-white'
      : 'bg-gradient-to-r from-purple-500/25 to-fuchsia-500/15 text-white',
    navDisabled: isDark ? 'text-white/20' : 'text-white/30',
    navDefault: isDark ? 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]',
    // Logout
    logoutText: isDark ? 'text-white/30' : 'text-white/40',
  };

  return (
    <div className={cn(isDark ? 'dark' : 'light-admin', 'flex h-screen', t.contentBg)}>
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r transition-all duration-300',
          t.sidebarBg,
          t.sidebarBorder,
          compactSidebar ? 'w-[68px]' : 'w-[240px]',
        )}
      >
        {/* Logo */}
        <div className={cn('py-5', compactSidebar ? 'px-3' : 'px-5')}>
          <div className={cn('flex items-center', compactSidebar ? 'justify-center' : 'gap-3')}>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-orange-400 flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
              <span className="text-white font-black text-lg leading-none">N</span>
            </div>
            {!compactSidebar && (
              <div>
                <h1 className="text-[15px] font-bold text-white tracking-tight">Nivo</h1>
                <p className="text-[10px] text-white/30 font-medium uppercase tracking-widest">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        {/* User Mini Profile */}
        {!compactSidebar ? (
          <div className={cn('mx-4 mb-4 rounded-xl p-3 flex items-center gap-3', t.sidebarGlass)}>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/90 truncate">Super Admin</p>
              <p className="text-[10px] text-white/30 truncate">{userEmail}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center" title="Super Admin">
              <Shield className="h-4 w-4 text-white" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn('flex-1 space-y-0.5', compactSidebar ? 'px-2' : 'px-3')}>
          {sidebarItems.map((item) => {
            const isActive = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                title={compactSidebar ? item.label : undefined}
              >
                <span
                  className={cn(
                    'flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 relative',
                    compactSidebar ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                    isActive
                      ? t.navActive
                      : t.navDefault,
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-purple-400 to-fuchsia-500" />
                  )}
                  <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-purple-400')} />
                  {!compactSidebar && item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className={cn('px-3 mb-1', compactSidebar && 'px-2')}>
          <button
            onClick={toggleCompactSidebar}
            title={compactSidebar ? 'Expandir sidebar' : 'Compactar sidebar'}
            className={cn(
              'w-full flex items-center rounded-lg py-2.5 text-[13px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200',
              compactSidebar ? 'justify-center px-2' : 'gap-3 px-3',
            )}
          >
            {compactSidebar ? (
              <PanelLeft className="h-[18px] w-[18px]" />
            ) : (
              <>
                <PanelLeftClose className="h-[18px] w-[18px]" />
                Compactar
              </>
            )}
          </button>
        </div>

        {/* Bottom: Sign Out */}
        <div className={cn('p-3', compactSidebar && 'p-2')}>
          <button
            onClick={handleLogout}
            title={compactSidebar ? 'Cerrar sesión' : undefined}
            className={cn(
              'w-full flex items-center rounded-lg py-2.5 text-[13px] font-medium hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 border border-transparent hover:border-red-500/10',
              t.logoutText,
              compactSidebar ? 'justify-center px-2' : 'gap-3 px-3',
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!compactSidebar && 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className={cn(
          'h-14 border-b backdrop-blur-sm flex items-center justify-between px-6 shrink-0',
          t.topbarBg,
          t.topbarBorder,
        )}>
          {/* Omnisearch Trigger */}
          <button
            onClick={() => setOmniOpen(true)}
            className={cn(
              'h-9 w-72 rounded-lg border pl-3 pr-2 text-sm flex items-center gap-2 transition-all',
              t.searchBg, t.searchBorder, t.searchPlaceholder,
              isDark ? 'hover:bg-white/[0.06] hover:border-white/[0.1]' : 'hover:bg-gray-50 hover:border-gray-300',
            )}
          >
            <Search className={cn('h-4 w-4 shrink-0', t.searchIcon)} />
            <span className={cn('flex-1 text-left', isDark ? 'text-white/20' : 'text-gray-400')}>Buscar zapaterías, páginas...</span>
            <kbd className={cn(
              'hidden sm:inline-flex h-5 items-center gap-0.5 rounded border px-1.5 font-mono text-[10px] font-medium',
              isDark
                ? 'border-white/[0.1] bg-white/[0.04] text-white/25'
                : 'border-gray-300 bg-gray-100 text-gray-400',
            )}>
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </button>

          <div className="flex items-center gap-2">
            {/* Notifications Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={toggleNotifications}
                className={cn(
                  'h-9 w-9 rounded-lg flex items-center justify-center transition-colors relative border',
                  notifOpen
                    ? cn(t.btnActiveBg, t.btnActiveBorder)
                    : cn(t.btnBg, t.btnBorder, t.btnHover),
                )}
              >
                <Bell className={cn('h-4 w-4', notifOpen ? 'text-purple-400' : t.btnIcon)} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 text-[10px] font-bold text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div className={cn('absolute right-0 top-12 w-[380px] rounded-xl border shadow-2xl z-50 overflow-hidden', t.dropdownBg, t.dropdownBorder, t.dropdownShadow)}>
                  {/* Header */}
                  <div className={cn('flex items-center justify-between px-4 py-3 border-b', t.dropdownDivider)}>
                    <div className="flex items-center gap-2">
                      <h3 className={cn('text-sm font-semibold', t.textPrimary)}>Notificaciones</h3>
                      {unreadCount > 0 && (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5 py-0">
                          {unreadCount}
                        </Badge>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
                      >
                        Marcar todo leído
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifLoading ? (
                      <div className="p-8 text-center">
                        <div className="h-5 w-5 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className={cn('h-8 w-8 mx-auto mb-2', t.notifEmptyIcon)} />
                        <p className={cn('text-sm', t.notifEmptyText)}>Sin notificaciones</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const config = NOTIF_ICONS[notif.type] || NOTIF_ICONS.system_alert;
                        const Icon = config.icon;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => !notif.is_read && markAsRead(notif.id)}
                            className={cn(
                              'flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer border-b last:border-0',
                              t.notifItemBorder,
                              notif.is_read
                                ? t.notifReadHover
                                : cn(t.notifBg, t.notifHover),
                            )}
                          >
                            <div className={cn('mt-0.5 shrink-0', config.color)}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                'text-[13px] leading-tight',
                                notif.is_read
                                  ? t.notifReadText
                                  : cn(t.notifUnreadText, 'font-medium'),
                              )}>
                                {notif.message}
                              </p>
                              <p className={cn('text-[11px] mt-1', t.notifTime)}>{timeAgo(notif.created_at)}</p>
                            </div>
                            {!notif.is_read && (
                              <span className="h-2 w-2 rounded-full bg-purple-400 shrink-0 mt-1.5" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                className={cn(
                  'h-9 flex items-center gap-2 rounded-lg px-2 transition-colors border',
                  profileOpen
                    ? cn(t.btnActiveBg, t.btnActiveBorder)
                    : cn('border-transparent', t.btnHover),
                )}
              >
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">{userInitials}</span>
                </div>
                <ChevronDown className={cn(
                  'h-3 w-3 transition-transform',
                  t.chevron,
                  profileOpen && 'rotate-180',
                )} />
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div className={cn('absolute right-0 top-12 w-[260px] rounded-xl border shadow-2xl z-50 overflow-hidden', t.dropdownBg, t.dropdownBorder, t.dropdownShadow)}>
                  {/* User Info Header */}
                  <div className={cn('px-4 py-4 border-b', t.dropdownDivider)}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{userInitials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className={cn('text-sm font-semibold', t.textPrimary)}>Super Admin</p>
                        <p className={cn('text-[11px] truncate', t.textMuted)}>{userEmail}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <button
                      onClick={() => { setProfileDialogOpen(true); setProfileOpen(false); setPwMessage(null); }}
                      className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors', t.menuText, t.menuHover)}
                    >
                      <User className="h-4 w-4" />
                      Mi Perfil
                    </button>
                    <button
                      onClick={() => { setPrefsDialogOpen(true); setProfileOpen(false); }}
                      className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors', t.menuText, t.menuHover)}
                    >
                      <Settings className="h-4 w-4" />
                      Preferencias
                    </button>
                  </div>

                  {/* Theme Toggle */}
                  <div className={cn('px-4 py-2.5 border-t', t.dropdownDivider)}>
                    <button
                      onClick={toggleTheme}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {isDark ? (
                          <Moon className={cn('h-4 w-4', t.textSecondary)} />
                        ) : (
                          <Sun className={cn('h-4 w-4', t.textSecondary)} />
                        )}
                        <span className={cn('text-[13px]', t.textSecondary)}>
                          {isDark ? 'Modo Oscuro' : 'Modo Claro'}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'h-5 w-9 rounded-full flex items-center px-0.5 cursor-pointer transition-colors border',
                          isDark ? t.toggleBgOn : t.toggleBgOff,
                        )}
                      >
                        <div
                          className={cn(
                            'h-4 w-4 rounded-full shadow-sm transition-all',
                            isDark
                              ? cn(t.toggleDotOn, 'ml-auto')
                              : cn(t.toggleDotOff, 'ml-0'),
                          )}
                        />
                      </div>
                    </button>
                  </div>

                  {/* Logout */}
                  <div className={cn('py-1 border-t', t.dropdownDivider)}>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
        </main>
      </div>

      {/* ====== Mi Perfil Dialog ====== */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className={cn(
          'border max-w-md',
          isDark
            ? 'bg-[#1a1530] border-white/[0.08] text-white'
            : 'bg-white border-gray-200 text-gray-900',
        )}>
          <DialogHeader>
            <DialogTitle className={cn('flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
              <User className="h-5 w-5 text-purple-400" />
              Mi Perfil
            </DialogTitle>
            <DialogDescription className={isDark ? 'text-white/40' : 'text-gray-500'}>
              Gestiona tu cuenta de administrador
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Account Info (read-only) */}
            <div className={cn(
              'rounded-lg border p-4 space-y-3',
              isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-gray-50 border-gray-200',
            )}>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">{userInitials}</span>
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', isDark ? 'text-white/90' : 'text-gray-900')}>Super Admin</p>
                  <p className={cn('text-xs', isDark ? 'text-white/40' : 'text-gray-500')}>{user?.role || 'super-admin'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className={cn('h-4 w-4', isDark ? 'text-white/30' : 'text-gray-400')} />
                <span className={isDark ? 'text-white/60' : 'text-gray-600'}>{userEmail}</span>
              </div>
            </div>

            {/* Change Password */}
            <div className="space-y-3">
              <h4 className={cn('text-sm font-semibold flex items-center gap-2', isDark ? 'text-white/70' : 'text-gray-700')}>
                <Lock className="h-4 w-4 text-purple-400" />
                Cambiar Contraseña
              </h4>

              <div className="space-y-2">
                <Label className={cn('text-xs', isDark ? 'text-white/50' : 'text-gray-500')}>Contraseña actual</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={cn(
                      'pr-10',
                      isDark
                        ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400',
                    )}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className={cn('absolute right-3 top-1/2 -translate-y-1/2', isDark ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600')}
                  >
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className={cn('text-xs', isDark ? 'text-white/50' : 'text-gray-500')}>Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={cn(
                      'pr-10',
                      isDark
                        ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400',
                    )}
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className={cn('absolute right-3 top-1/2 -translate-y-1/2', isDark ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-600')}
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className={cn('text-xs', isDark ? 'text-white/50' : 'text-gray-500')}>Confirmar nueva contraseña</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    isDark
                      ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400',
                  )}
                  placeholder="Repite la nueva contraseña"
                />
              </div>

              {/* Feedback message */}
              {pwMessage && (
                <div className={cn(
                  'rounded-lg px-3 py-2 text-[13px] flex items-center gap-2 border',
                  pwMessage.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20',
                )}>
                  {pwMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {pwMessage.text}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setProfileDialogOpen(false)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm transition-colors',
                isDark ? 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              )}
            >
              Cancelar
            </button>
            <button
              onClick={handleChangePassword}
              disabled={pwChanging || !currentPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white hover:from-purple-600 hover:to-fuchsia-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {pwChanging && <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {pwChanging ? 'Guardando...' : 'Cambiar Contraseña'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Preferencias Dialog ====== */}
      <Dialog open={prefsDialogOpen} onOpenChange={setPrefsDialogOpen}>
        <DialogContent className={cn(
          'border max-w-md',
          isDark
            ? 'bg-[#1a1530] border-white/[0.08] text-white'
            : 'bg-white border-gray-200 text-gray-900',
        )}>
          <DialogHeader>
            <DialogTitle className={cn('flex items-center gap-2', isDark ? 'text-white' : 'text-gray-900')}>
              <Settings className="h-5 w-5 text-purple-400" />
              Preferencias
            </DialogTitle>
            <DialogDescription className={isDark ? 'text-white/40' : 'text-gray-500'}>
              Personaliza tu experiencia en el panel de administración
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Appearance */}
            <div className={cn(
              'rounded-lg border p-4 space-y-4',
              isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-gray-50 border-gray-200',
            )}>
              <h4 className={cn('text-sm font-semibold flex items-center gap-2', isDark ? 'text-white/70' : 'text-gray-700')}>
                <Palette className="h-4 w-4 text-purple-400" />
                Apariencia
              </h4>

              {/* Theme selection */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className={cn('h-4 w-4', isDark ? 'text-white/30' : 'text-gray-400')} />
                  <span className={cn('text-sm', isDark ? 'text-white/60' : 'text-gray-600')}>Tema</span>
                </div>
                <div className={cn(
                  'flex gap-1 rounded-lg p-0.5 border',
                  isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-gray-100 border-gray-200',
                )}>
                  <button
                    onClick={() => { setIsDark(true); localStorage.setItem('nivo-admin-theme', 'dark'); }}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      isDark
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-gray-400 hover:text-gray-600 border border-transparent',
                    )}
                  >
                    <Moon className="h-3 w-3 inline mr-1" />
                    Oscuro
                  </button>
                  <button
                    onClick={() => { setIsDark(false); localStorage.setItem('nivo-admin-theme', 'light'); }}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      !isDark
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-gray-400 hover:text-gray-600 border border-transparent',
                    )}
                  >
                    <Sun className="h-3 w-3 inline mr-1" />
                    Claro
                  </button>
                </div>
              </div>

              {/* Compact sidebar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PanelLeftClose className={cn('h-4 w-4', isDark ? 'text-white/30' : 'text-gray-400')} />
                  <span className={cn('text-sm', isDark ? 'text-white/60' : 'text-gray-600')}>Sidebar compacto</span>
                </div>
                <button
                  onClick={() => setCompactSidebar(!compactSidebar)}
                  className={cn(
                    'h-5 w-9 rounded-full flex items-center px-0.5 transition-colors border',
                    compactSidebar ? t.toggleBgOn : t.toggleBgOff,
                  )}
                >
                  <div
                    className={cn(
                      'h-4 w-4 rounded-full shadow-sm transition-all',
                      compactSidebar
                        ? cn(t.toggleDotOn, 'ml-auto')
                        : cn(t.toggleDotOff, 'ml-0'),
                    )}
                  />
                </button>
              </div>

              {/* Animations toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className={cn('h-4 w-4', isDark ? 'text-white/30' : 'text-gray-400')} />
                  <span className={cn('text-sm', isDark ? 'text-white/60' : 'text-gray-600')}>Animaciones</span>
                </div>
                <button
                  onClick={() => setPrefAnimations(!prefAnimations)}
                  className={cn(
                    'h-5 w-9 rounded-full flex items-center px-0.5 transition-colors border',
                    prefAnimations ? t.toggleBgOn : t.toggleBgOff,
                  )}
                >
                  <div
                    className={cn(
                      'h-4 w-4 rounded-full shadow-sm transition-all',
                      prefAnimations
                        ? cn(t.toggleDotOn, 'ml-auto')
                        : cn(t.toggleDotOff, 'ml-0'),
                    )}
                  />
                </button>
              </div>
            </div>

            {/* General */}
            <div className={cn(
              'rounded-lg border p-4 space-y-4',
              isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-gray-50 border-gray-200',
            )}>
              <h4 className={cn('text-sm font-semibold flex items-center gap-2', isDark ? 'text-white/70' : 'text-gray-700')}>
                <Globe className="h-4 w-4 text-purple-400" />
                General
              </h4>

              {/* Language */}
              <div className="flex items-center justify-between">
                <span className={cn('text-sm', isDark ? 'text-white/60' : 'text-gray-600')}>Idioma</span>
                <div className={cn(
                  'flex gap-1 rounded-lg p-0.5 border',
                  isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-gray-100 border-gray-200',
                )}>
                  <button
                    onClick={() => setPrefLanguage('es')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      prefLanguage === 'es'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : cn(isDark ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600', 'border border-transparent'),
                    )}
                  >
                    Español
                  </button>
                  <button
                    onClick={() => setPrefLanguage('en')}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      prefLanguage === 'en'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : cn(isDark ? 'text-white/40 hover:text-white/60' : 'text-gray-400 hover:text-gray-600', 'border border-transparent'),
                    )}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              onClick={() => setPrefsDialogOpen(false)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm transition-colors',
                isDark ? 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
              )}
            >
              Cancelar
            </button>
            <button
              onClick={savePreferences}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white hover:from-purple-600 hover:to-fuchsia-700 transition-all"
            >
              Guardar Preferencias
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Omnisearch Modal ====== */}
      {omniOpen && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div
            className={cn(
              'absolute inset-0',
              isDark ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/30 backdrop-blur-sm',
            )}
            onClick={() => setOmniOpen(false)}
          />

          {/* Modal */}
          <div className="relative flex justify-center pt-[15vh]">
            <div className={cn(
              'w-full max-w-[560px] rounded-2xl border shadow-2xl overflow-hidden mx-4',
              isDark
                ? 'bg-[#1a1530] border-white/[0.1] shadow-black/60'
                : 'bg-white border-gray-200 shadow-gray-400/30',
            )}>
              {/* Search Input */}
              <div className={cn('flex items-center gap-3 px-4 h-14 border-b', isDark ? 'border-white/[0.06]' : 'border-gray-100')}>
                <Search className={cn('h-5 w-5 shrink-0', isDark ? 'text-purple-400' : 'text-purple-500')} />
                <input
                  ref={omniInputRef}
                  type="text"
                  value={omniQuery}
                  onChange={(e) => { setOmniQuery(e.target.value); setOmniSelected(0); }}
                  onKeyDown={handleOmniKeyDown}
                  placeholder="Buscar zapaterías, navegar a páginas..."
                  className={cn(
                    'flex-1 bg-transparent text-[15px] font-light focus:outline-none',
                    isDark ? 'text-white placeholder:text-white/25' : 'text-gray-900 placeholder:text-gray-400',
                  )}
                />
                {omniLoading && (
                  <div className="h-4 w-4 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin shrink-0" />
                )}
                <kbd className={cn(
                  'h-6 flex items-center rounded px-1.5 font-mono text-[11px] font-medium border',
                  isDark
                    ? 'border-white/[0.08] bg-white/[0.04] text-white/20'
                    : 'border-gray-200 bg-gray-100 text-gray-400',
                )}>
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className={cn('max-h-[360px] overflow-y-auto', isDark ? 'divide-white/[0.03]' : 'divide-gray-50')}>
                {omniResults.length === 0 && omniQuery && !omniLoading ? (
                  <div className="px-4 py-10 text-center">
                    <Search className={cn('h-8 w-8 mx-auto mb-3', isDark ? 'text-white/10' : 'text-gray-200')} />
                    <p className={cn('text-sm font-medium', isDark ? 'text-white/30' : 'text-gray-400')}>
                      Sin resultados para &ldquo;{omniQuery}&rdquo;
                    </p>
                    <p className={cn('text-xs mt-1', isDark ? 'text-white/15' : 'text-gray-300')}>
                      Intenta con otro término de búsqueda
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Tenants section */}
                    {omniResults.some((r) => r.type === 'tenant') && (
                      <div className="py-1.5">
                        <p className={cn('px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest', isDark ? 'text-white/20' : 'text-gray-400')}>
                          Zapaterías
                        </p>
                        {omniResults
                          .filter((r) => r.type === 'tenant')
                          .map((result, idx) => {
                            const globalIdx = omniResults.indexOf(result);
                            return (
                              <button
                                key={result.id}
                                onClick={() => executeOmniResult(result)}
                                onMouseEnter={() => setOmniSelected(globalIdx)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                  omniSelected === globalIdx
                                    ? isDark ? 'bg-purple-500/10' : 'bg-purple-50'
                                    : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50',
                                )}
                              >
                                <div className={cn(
                                  'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                                  isDark ? 'bg-purple-500/10 border border-purple-500/10' : 'bg-purple-50 border border-purple-100',
                                )}>
                                  <result.icon className={cn('h-4 w-4', result.iconColor || 'text-purple-400')} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-sm font-medium truncate', isDark ? 'text-white/85' : 'text-gray-900')}>
                                    {result.title}
                                  </p>
                                  {result.subtitle && (
                                    <p className={cn('text-xs truncate', isDark ? 'text-white/30' : 'text-gray-400')}>
                                      {result.subtitle}
                                    </p>
                                  )}
                                </div>
                                {omniSelected === globalIdx && (
                                  <kbd className={cn(
                                    'h-5 flex items-center rounded px-1 font-mono text-[10px] border shrink-0',
                                    isDark ? 'border-white/[0.06] bg-white/[0.03] text-white/15' : 'border-gray-200 bg-gray-50 text-gray-300',
                                  )}>
                                    &#9166;
                                  </kbd>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}

                    {/* Navigation section */}
                    {omniResults.some((r) => r.type === 'nav') && (
                      <div className={cn('py-1.5', omniResults.some((r) => r.type === 'tenant') && (isDark ? 'border-t border-white/[0.04]' : 'border-t border-gray-100'))}>
                        <p className={cn('px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest', isDark ? 'text-white/20' : 'text-gray-400')}>
                          Navegación
                        </p>
                        {omniResults
                          .filter((r) => r.type === 'nav')
                          .map((result) => {
                            const globalIdx = omniResults.indexOf(result);
                            return (
                              <button
                                key={result.id}
                                onClick={() => executeOmniResult(result)}
                                onMouseEnter={() => setOmniSelected(globalIdx)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                  omniSelected === globalIdx
                                    ? isDark ? 'bg-purple-500/10' : 'bg-purple-50'
                                    : isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50',
                                )}
                              >
                                <div className={cn(
                                  'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                                  isDark ? 'bg-white/[0.04]' : 'bg-gray-100',
                                )}>
                                  <result.icon className={cn('h-4 w-4', result.iconColor || (isDark ? 'text-white/40' : 'text-gray-500'))} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-sm font-medium', isDark ? 'text-white/70' : 'text-gray-700')}>
                                    {result.title}
                                  </p>
                                  {result.subtitle && (
                                    <p className={cn('text-xs', isDark ? 'text-white/25' : 'text-gray-400')}>
                                      {result.subtitle}
                                    </p>
                                  )}
                                </div>
                                {omniSelected === globalIdx && (
                                  <kbd className={cn(
                                    'h-5 flex items-center rounded px-1 font-mono text-[10px] border shrink-0',
                                    isDark ? 'border-white/[0.06] bg-white/[0.03] text-white/15' : 'border-gray-200 bg-gray-50 text-gray-300',
                                  )}>
                                    &#9166;
                                  </kbd>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className={cn(
                'flex items-center justify-between px-4 py-2.5 border-t text-[11px]',
                isDark ? 'border-white/[0.06] text-white/15' : 'border-gray-100 text-gray-300',
              )}>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className={cn('h-4 px-1 rounded border font-mono text-[9px] inline-flex items-center', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>&#8593;</kbd>
                    <kbd className={cn('h-4 px-1 rounded border font-mono text-[9px] inline-flex items-center', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>&#8595;</kbd>
                    navegar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className={cn('h-4 px-1 rounded border font-mono text-[9px] inline-flex items-center', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>&#9166;</kbd>
                    abrir
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className={cn('h-4 px-1 rounded border font-mono text-[9px] inline-flex items-center', isDark ? 'border-white/[0.06]' : 'border-gray-200')}>esc</kbd>
                    cerrar
                  </span>
                </div>
                <span className={isDark ? 'text-purple-400/40' : 'text-purple-300'}>Nivo Omnisearch</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
