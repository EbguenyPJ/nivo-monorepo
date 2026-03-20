'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  cn,
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Label,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  toast,
} from '@nivo/ui';
import {
  Search,
  Send,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Loader2,
  ChevronDown,
  X,
  ImagePlus,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TicketMessage {
  id: string;
  sender_type: 'tenant' | 'admin';
  sender_name: string;
  message: string;
  created_at: string;
}

interface Ticket {
  id: string;
  tenant_id: string;
  tenant_name: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string | null;
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
}

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  avgResponseTime: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: 'Abierto', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  in_progress: { label: 'En Progreso', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  resolved: { label: 'Resuelto', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  closed: { label: 'Cerrado', className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: 'Baja', className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  medium: { label: 'Media', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  high: { label: 'Alta', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  urgent: { label: 'Urgente', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'billing', label: 'Facturación' },
  { value: 'technical', label: 'Técnico' },
  { value: 'feature_request', label: 'Sugerencia' },
  { value: 'bug', label: 'Error / Bug' },
];

const PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  const months = Math.floor(days / 30);
  return `hace ${months}mes${months > 1 ? 'es' : ''}`;
}

function formatMessageDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SupportPage() {
  // ---- Ticket list state ----
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // ---- Filters ----
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // ---- Stats ----
  const [stats, setStats] = useState<TicketStats | null>(null);

  // ---- Selected ticket ----
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);

  // ---- Reply ----
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ---- Status dropdown ----
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // ---- Create dialog ----
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    message: '',
  });

  // ---- Tenant search (create dialog) ----
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantResults, setTenantResults] = useState<{ id: string; name: string; subdomain: string }[]>([]);
  const [tenantSearching, setTenantSearching] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<{ id: string; name: string } | null>(null);
  const tenantDropdownRef = useRef<HTMLDivElement>(null);

  // ---- Attachments (create dialog) ----
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------
  // Fetch tickets list
  // -------------------------------------------------------------------

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);

      const response = await apiClient.get(`/support/tickets?${params.toString()}`);
      setTickets(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, statusFilter, priorityFilter]);

  // -------------------------------------------------------------------
  // Fetch stats
  // -------------------------------------------------------------------

  const fetchStats = useCallback(async () => {
    try {
      const response = await apiClient.get('/support/tickets/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  // -------------------------------------------------------------------
  // Fetch single ticket
  // -------------------------------------------------------------------

  const fetchTicket = useCallback(async (id: string) => {
    setLoadingTicket(true);
    try {
      const response = await apiClient.get(`/support/tickets/${id}`);
      setSelectedTicket(response.data);
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar el ticket.',
        variant: 'destructive',
      });
    } finally {
      setLoadingTicket(false);
    }
  }, []);

  // -------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load selected ticket
  useEffect(() => {
    if (selectedTicketId) {
      fetchTicket(selectedTicketId);
    } else {
      setSelectedTicket(null);
    }
  }, [selectedTicketId, fetchTicket]);

  // Auto-scroll messages
  useEffect(() => {
    if (selectedTicket?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  // Close status dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (tenantDropdownRef.current && !tenantDropdownRef.current.contains(e.target as Node)) {
        setTenantResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced tenant search
  useEffect(() => {
    if (!tenantSearch.trim() || selectedTenant) {
      setTenantResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setTenantSearching(true);
      try {
        const res = await apiClient.get(`/tenants?search=${encodeURIComponent(tenantSearch.trim())}&limit=6&page=1`);
        const items = res.data.data || res.data || [];
        setTenantResults(
          items.map((t: any) => ({ id: t.id, name: t.name, subdomain: t.subdomain || '' }))
        );
      } catch {
        setTenantResults([]);
      } finally {
        setTenantSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [tenantSearch, selectedTenant]);

  // -------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicketId) return;
    setSending(true);
    try {
      await apiClient.post(`/support/tickets/${selectedTicketId}/messages`, {
        sender_type: 'admin',
        sender_name: 'Super Admin',
        message: replyMessage.trim(),
      });
      setReplyMessage('');
      await fetchTicket(selectedTicketId);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!selectedTicketId) return;
    setStatusDropdownOpen(false);
    try {
      await apiClient.patch(`/support/tickets/${selectedTicketId}/status`, {
        status: newStatus,
      });
      await fetchTicket(selectedTicketId);
      await fetchTickets();
      await fetchStats();
      toast({
        title: 'Estado actualizado',
        description: `El ticket ahora está ${STATUS_CONFIG[newStatus]?.label || newStatus}.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) {
      toast({ title: 'Selecciona un tenant', description: 'Busca y selecciona una zapatería.', variant: 'destructive' });
      return;
    }
    if (!createForm.subject.trim() || !createForm.message.trim()) {
      toast({ title: 'Campos requeridos', description: 'Completa todos los campos.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('tenant_id', selectedTenant.id);
      formData.append('tenant_name', selectedTenant.name);
      formData.append('subject', createForm.subject.trim());
      formData.append('category', createForm.category);
      formData.append('priority', createForm.priority);
      formData.append('message', createForm.message.trim());

      // Append each file with the key 'attachments'
      attachments.forEach((file) => {
        formData.append('attachments', file);
      });

      await apiClient.post('/support/tickets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setCreateOpen(false);
      setCreateForm({ subject: '', category: 'general', priority: 'medium', message: '' });
      setSelectedTenant(null);
      setTenantSearch('');
      setAttachments([]);
      toast({ title: 'Ticket creado', description: 'El ticket se creó correctamente.' });
      await fetchTickets();
      await fetchStats();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo crear el ticket.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Soporte</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestiona los tickets de soporte de tus clientes
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-2 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 border-0"
        >
          <Plus className="h-4 w-4" />
          Nuevo Ticket
        </Button>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4 h-[calc(100vh-10rem)]">
        {/* ============================================================= */}
        {/* LEFT PANEL — Ticket list                                       */}
        {/* ============================================================= */}
        <div className="w-[400px] shrink-0 flex flex-col gap-3">
          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', value: stats?.total ?? '—', icon: Inbox, color: 'text-foreground' },
              { label: 'Abiertos', value: stats?.open ?? '—', icon: AlertCircle, color: 'text-blue-500' },
              { label: 'En Progreso', value: stats?.inProgress ?? '—', icon: Clock, color: 'text-amber-500' },
              { label: 'Resueltos', value: stats?.resolved ?? '—', icon: CheckCircle2, color: 'text-emerald-500' },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-3 text-center">
                  <stat.icon className={cn('h-4 w-4 mx-auto mb-1', stat.color)} />
                  <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tickets..."
                className="pl-10"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="resolved">Resuelto</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las prioridades</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ticket List */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-14" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <MessageSquare className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">Sin tickets</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No se encontraron tickets con los filtros actuales.
                </p>
              </div>
            ) : (
              <>
                {tickets.map((ticket) => {
                  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                  const priorityCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
                  const isSelected = selectedTicketId === ticket.id;

                  return (
                    <Card
                      key={ticket.id}
                      className={cn(
                        'cursor-pointer transition-all hover:border-purple-500/40',
                        isSelected && 'border-purple-500 ring-1 ring-purple-500/30',
                      )}
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-medium text-foreground truncate flex-1">
                            {ticket.subject}
                          </p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                            {timeAgo(ticket.updated_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 truncate">
                          {ticket.tenant_name}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusCfg.className)}>
                            {statusCfg.label}
                          </Badge>
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', priorityCfg.className)}>
                            {priorityCfg.label}
                          </Badge>
                          {ticket.category && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {CATEGORY_OPTIONS.find((c) => c.value === ticket.category)?.label || ticket.category}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ============================================================= */}
        {/* RIGHT PANEL — Ticket detail                                    */}
        {/* ============================================================= */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedTicketId ? (
            /* Empty state */
            <Card className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Selecciona un ticket</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Haz clic en un ticket de la lista para ver su conversaci&oacute;n y responder.
                </p>
              </div>
            </Card>
          ) : loadingTicket || !selectedTicket ? (
            /* Loading state */
            <Card className="flex-1 flex flex-col">
              <CardContent className="p-6 space-y-4 flex-1">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <div className="space-y-3 mt-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className={cn('h-16 rounded-lg', i % 2 === 0 ? 'w-3/4' : 'w-3/4 ml-auto')} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Ticket detail */
            <Card className="flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {selectedTicket.subject}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {selectedTicket.tenant_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Badge variant="outline" className={STATUS_CONFIG[selectedTicket.status]?.className}>
                        {STATUS_CONFIG[selectedTicket.status]?.label}
                      </Badge>
                      <Badge variant="outline" className={PRIORITY_CONFIG[selectedTicket.priority]?.className}>
                        {PRIORITY_CONFIG[selectedTicket.priority]?.label}
                      </Badge>
                      {selectedTicket.category && (
                        <Badge variant="outline">
                          {CATEGORY_OPTIONS.find((c) => c.value === selectedTicket.category)?.label || selectedTicket.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Change status dropdown */}
                    <div className="relative" ref={statusDropdownRef}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                      >
                        Cambiar Estado
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      {statusDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 w-44 rounded-md border border-border bg-card shadow-lg z-50">
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <button
                              key={key}
                              className={cn(
                                'w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors first:rounded-t-md last:rounded-b-md',
                                selectedTicket.status === key && 'bg-muted font-medium',
                              )}
                              onClick={() => handleChangeStatus(key)}
                            >
                              {cfg.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Close ticket button */}
                    {selectedTicket.status !== 'closed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => handleChangeStatus('closed')}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cerrar
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Attachments */}
              {(selectedTicket as any).attachments && (selectedTicket as any).attachments.length > 0 && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-muted-foreground mb-2">Evidencia adjunta</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedTicket as any).attachments.map((att: any) => (
                      <a
                        key={att.id}
                        href={`${apiClient.defaults.baseURL?.replace('/api/v1', '')}/uploads/support/${att.stored_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block h-20 w-20 rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-purple-500/40 transition-all"
                      >
                        <img
                          src={`${apiClient.defaults.baseURL?.replace('/api/v1', '')}/uploads/support/${att.stored_name}`}
                          alt={att.original_name}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {selectedTicket.messages.map((msg) => {
                  const isAdmin = msg.sender_type === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] rounded-lg px-3.5 py-2.5',
                          isAdmin
                            ? 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white'
                            : 'bg-muted text-foreground',
                        )}
                      >
                        <div
                          className={cn(
                            'flex items-center gap-2 mb-1',
                            isAdmin ? 'text-white/80' : 'text-muted-foreground',
                          )}
                        >
                          <span className="text-xs font-medium">{msg.sender_name}</span>
                          <span className="text-[10px]">{formatMessageDate(msg.created_at)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply form */}
              {selectedTicket.status !== 'closed' && (
                <div className="p-4 border-t border-border shrink-0">
                  <div className="flex gap-2">
                    <textarea
                      className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px] max-h-[120px]"
                      placeholder="Escribe tu respuesta..."
                      rows={2}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <Button
                      className="shrink-0 bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0 self-end"
                      disabled={!replyMessage.trim() || sending}
                      onClick={handleSendReply}
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* CREATE TICKET DIALOG                                            */}
      {/* ============================================================= */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) {
          setTenantSearch('');
          setTenantResults([]);
          setSelectedTenant(null);
          setAttachments([]);
          setCreateForm({ subject: '', category: 'general', priority: 'medium', message: '' });
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleCreateTicket}>
            <DialogHeader>
              <DialogTitle>Nuevo Ticket de Soporte</DialogTitle>
              <DialogDescription>
                Crea un ticket en nombre de un tenant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Tenant search / select */}
              <div className="space-y-2">
                <Label>Tenant</Label>
                {selectedTenant ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm">
                    <span className="flex-1 text-foreground">{selectedTenant.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedTenant(null);
                        setTenantSearch('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={tenantDropdownRef}>
                    <Input
                      placeholder="Buscar tenant por nombre..."
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      autoComplete="off"
                    />
                    {tenantSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {tenantResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-popover/95 backdrop-blur-xl border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {tenantResults.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={() => {
                              setSelectedTenant({ id: t.id, name: t.name });
                              setTenantSearch('');
                              setTenantResults([]);
                            }}
                          >
                            <span className="font-medium text-foreground">{t.name}</span>
                            {t.subdomain && (
                              <span className="ml-2 text-muted-foreground">{t.subdomain}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="create-subject">Asunto</Label>
                <Input
                  id="create-subject"
                  placeholder="Problema con el inventario"
                  value={createForm.subject}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, subject: e.target.value }))}
                  required
                />
              </div>

              {/* Category + Priority side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-category">Categor&iacute;a</Label>
                  <Select
                    value={createForm.category}
                    onValueChange={(v) => setCreateForm((prev) => ({ ...prev, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-priority">Prioridad</Label>
                  <Select
                    value={createForm.priority}
                    onValueChange={(v) => setCreateForm((prev) => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="create-message">Mensaje</Label>
                <textarea
                  id="create-message"
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px]"
                  placeholder="Describe el problema o solicitud..."
                  rows={3}
                  value={createForm.message}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, message: e.target.value }))}
                  required
                />
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <Label>Evidencia (opcional, máx. 3 imágenes)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAttachments((prev) => [...prev, ...files].slice(0, 3));
                    e.target.value = '';
                  }}
                />
                {attachments.length < 3 && (
                  <div
                    className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/50 px-4 py-6 cursor-pointer hover:border-muted-foreground transition-colors text-muted-foreground text-sm"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
                      setAttachments((prev) => [...prev, ...files].slice(0, 3));
                    }}
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span>Arrastra imágenes aquí o haz clic para seleccionar</span>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="relative group w-20 h-20 rounded-md overflow-hidden border border-border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 border-0"
              >
                {creating ? 'Creando...' : 'Crear Ticket'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
