'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Input, Textarea,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  toast,
} from '@nivo/ui';
import {
  HelpCircle, Plus, Send, Loader2, ChevronLeft, ChevronRight,
  MessageSquare, Clock, CheckCircle2, AlertCircle, Inbox,
  Paperclip, X, Image as ImageIcon, Mail, Phone,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// ─── Types ───────────────────────────────────────────────────────

interface TicketAttachment {
  id: string;
  message_id: string | null;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

interface TicketMessage {
  id: string;
  sender_type: 'tenant' | 'admin';
  sender_name: string | null;
  message: string;
  created_at: string;
}

interface Ticket {
  id: string;
  tenant_id: string;
  tenant_name: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
  attachments?: TicketAttachment[];
}

// ─── Constants ──────────────────────────────────────────────────

const PAGE_SIZE = 15;

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  open: { label: 'Abierto', variant: 'default', icon: <AlertCircle className="h-3 w-3" /> },
  in_progress: { label: 'En Progreso', variant: 'outline', icon: <Clock className="h-3 w-3" /> },
  resolved: { label: 'Resuelto', variant: 'secondary', icon: <CheckCircle2 className="h-3 w-3" /> },
  closed: { label: 'Cerrado', variant: 'secondary', icon: <CheckCircle2 className="h-3 w-3" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Baja', color: 'text-muted-foreground' },
  medium: { label: 'Media', color: 'text-blue-500' },
  high: { label: 'Alta', color: 'text-amber-500' },
  urgent: { label: 'Urgente', color: 'text-red-500' },
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  billing: 'Facturación',
  technical: 'Técnico',
  feature_request: 'Sugerencia',
  bug: 'Error / Bug',
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatDateFull(d: string) {
  return new Date(d).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Build full URL for a support attachment */
function attachmentUrl(storedName: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  return `${base}/tenant-support/uploads/${storedName}`;
}

// ─── Page ────────────────────────────────────────────────────────

interface SupportInfo {
  support_type: string;
  support_hours: string | null;
}

const SUPPORT_TYPE_CONFIG: Record<string, { label: string; icon: typeof Mail; className: string }> = {
  email: { label: 'Soporte por correo',  icon: Mail,            className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  chat:  { label: 'Chat en vivo',        icon: MessageSquare,   className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  phone: { label: 'Soporte telefónico',  icon: Phone,           className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

export default function TenantSupportPage() {
  const { tenant, user } = useAuthStore();

  // Subscription support info (loaded in background)
  const [supportInfo, setSupportInfo] = useState<SupportInfo | null>(null);

  // List state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Detail state (two-column: selected ticket on the right)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replying, setReplying] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ─── Fetch tickets ───────────────────────────────────────────

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await apiClient.get('/tenant-support/tickets', { params });
      setTickets(res.data.data || []);
      setTotalCount(res.data.total || 0);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los tickets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Load subscription support info (non-blocking)
  useEffect(() => {
    apiClient.get('/tenant-subscription/me')
      .then((res) => {
        const effective = res.data?.effective;
        if (effective) {
          setSupportInfo({
            support_type: effective.support_type || 'email',
            support_hours: effective.support_hours || null,
          });
        }
      })
      .catch(() => {}); // silently ignore — support page works regardless
  }, []);

  // ─── Fetch ticket detail ──────────────────────────────────────

  const openTicket = useCallback(async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailLoading(true);
    try {
      const res = await apiClient.get(`/tenant-support/tickets/${ticketId}`);
      setSelectedTicket(res.data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el ticket', variant: 'destructive' });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Auto-refresh selected ticket periodically
  useEffect(() => {
    if (!selectedTicketId) return;
    const interval = setInterval(() => {
      apiClient.get(`/tenant-support/tickets/${selectedTicketId}`)
        .then((res) => setSelectedTicket(res.data))
        .catch(() => {});
    }, 30000); // every 30s
    return () => clearInterval(interval);
  }, [selectedTicketId]);

  // ─── File handling ────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast({ title: 'Archivo no permitido', description: `"${file.name}" no es una imagen válida.`, variant: 'destructive' });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'Archivo muy grande', description: `"${file.name}" excede el límite de 5 MB.`, variant: 'destructive' });
        continue;
      }
      valid.push(file);
    }

    const total = replyFiles.length + valid.length;
    if (total > 3) {
      toast({ title: 'Máximo 3 imágenes', description: 'Solo puedes adjuntar hasta 3 imágenes por mensaje.', variant: 'destructive' });
      setReplyFiles((prev) => [...prev, ...valid].slice(0, 3));
    } else {
      setReplyFiles((prev) => [...prev, ...valid]);
    }

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setReplyFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Send reply ───────────────────────────────────────────────

  const handleReply = async () => {
    if ((!replyText.trim() && replyFiles.length === 0) || !selectedTicket) return;
    setReplying(true);
    try {
      const formData = new FormData();
      formData.append('message', replyText.trim() || '(imagen adjunta)');
      replyFiles.forEach((file) => formData.append('attachments', file));

      const res = await apiClient.post(
        `/tenant-support/tickets/${selectedTicket.id}/messages`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setSelectedTicket(res.data);
      setReplyText('');
      setReplyFiles([]);
      fetchTickets();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      toast({ title: 'Error', description: 'No se pudo enviar el mensaje', variant: 'destructive' });
    } finally {
      setReplying(false);
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────

  /** Get attachments for a specific message */
  const getMessageAttachments = (msgId: string): TicketAttachment[] => {
    if (!selectedTicket?.attachments) return [];
    return selectedTicket.attachments.filter((a) => a.message_id === msgId);
  };

  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Soporte Nivo</h2>
          <p className="text-muted-foreground">
            Crea tickets de soporte y comunícate con nuestro equipo.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Support channel badge from subscription */}
          {supportInfo && (() => {
            const cfg = SUPPORT_TYPE_CONFIG[supportInfo.support_type] || SUPPORT_TYPE_CONFIG.email;
            const CfgIcon = cfg.icon;
            return (
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${cfg.className}`}>
                <CfgIcon className="h-4 w-4 shrink-0" />
                <div>
                  <span className="font-medium">{cfg.label}</span>
                  {supportInfo.support_hours && (
                    <span className="ml-2 opacity-70 text-xs">{supportInfo.support_hours}</span>
                  )}
                </div>
              </div>
            );
          })()}
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nuevo Ticket
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5" style={{ height: 'calc(100vh - 230px)' }}>
        {/* ═══ LEFT: Ticket List ═══ */}
        <div className={`flex flex-col ${selectedTicketId ? 'w-[380px] flex-shrink-0' : 'flex-1'} transition-all duration-200`}>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abiertos</SelectItem>
                <SelectItem value="in_progress">En progreso</SelectItem>
                <SelectItem value="resolved">Resueltos</SelectItem>
                <SelectItem value="closed">Cerrados</SelectItem>
              </SelectContent>
            </Select>

            {openCount > 0 && (
              <Badge variant="outline" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {openCount} pendiente{openCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
              </div>
            ) : tickets.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Inbox className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold mb-1">
                    {statusFilter !== 'all' ? 'Sin tickets en este estado' : 'Sin tickets de soporte'}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-3">
                    {statusFilter !== 'all'
                      ? 'No hay tickets con el filtro seleccionado.'
                      : 'Crea tu primer ticket si necesitas ayuda con Nivo.'}
                  </p>
                  {statusFilter === 'all' && (
                    <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                      <Plus className="h-4 w-4" />
                      Crear mi primer ticket
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {tickets.map((ticket) => {
                  const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                  const priorityCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
                  const lastMsg = ticket.messages?.[ticket.messages.length - 1];
                  const unreadAdmin = lastMsg?.sender_type === 'admin';
                  const isActive = selectedTicketId === ticket.id;

                  return (
                    <div
                      key={ticket.id}
                      className={`rounded-xl border p-3 cursor-pointer transition-all ${
                        isActive
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : unreadAdmin
                            ? 'border-primary/30 bg-primary/[0.02] hover:bg-primary/[0.04]'
                            : 'border-border bg-card hover:bg-muted/50'
                      }`}
                      onClick={() => openTicket(ticket.id)}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'bg-primary/15' : unreadAdmin ? 'bg-primary/10' : 'bg-muted'
                        }`}>
                          <MessageSquare className={`h-3.5 w-3.5 ${isActive || unreadAdmin ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h4 className="font-medium text-sm truncate flex-1">
                              {ticket.subject}
                            </h4>
                            {unreadAdmin && !isActive && (
                              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">
                              {timeAgo(ticket.updated_at)}
                            </span>
                          </div>

                          {lastMsg && (
                            <p className="text-xs text-muted-foreground truncate mb-1">
                              {lastMsg.sender_type === 'admin' ? 'Soporte: ' : 'Tú: '}
                              {lastMsg.message}
                            </p>
                          )}

                          <div className="flex items-center gap-1.5">
                            <Badge variant={statusCfg.variant} className="gap-0.5 text-[10px] px-1.5 py-0">
                              {statusCfg.icon}
                              {statusCfg.label}
                            </Badge>
                            <span className={`text-[10px] font-medium ${priorityCfg.color}`}>
                              {priorityCfg.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 pb-1">
                    <p className="text-[10px] text-muted-foreground">
                      {totalCount} ticket{totalCount !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground">{page}/{totalPages}</span>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══ RIGHT: Ticket Detail / Chat ═══ */}
        {selectedTicketId ? (
          <div className="flex-1 flex flex-col min-w-0 border rounded-xl bg-card overflow-hidden">
            {detailLoading && !selectedTicket ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedTicket ? (
              <>
                {/* Ticket header */}
                <div className="border-b px-5 py-3 flex items-start justify-between bg-card">
                  <div className="flex-1 min-w-0 mr-3">
                    <h3 className="font-semibold text-sm leading-tight truncate">{selectedTicket.subject}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{formatDateFull(selectedTicket.created_at)}</span>
                      {selectedTicket.category && (
                        <>
                          <span>·</span>
                          <span>{CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(() => {
                      const statusCfg = STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.open;
                      const priorityCfg = PRIORITY_CONFIG[selectedTicket.priority] || PRIORITY_CONFIG.medium;
                      return (
                        <>
                          <span className={`text-xs font-medium ${priorityCfg.color}`}>{priorityCfg.label}</span>
                          <Badge variant={statusCfg.variant} className="gap-1">
                            {statusCfg.icon}
                            {statusCfg.label}
                          </Badge>
                        </>
                      );
                    })()}
                    <button
                      onClick={() => { setSelectedTicketId(null); setSelectedTicket(null); }}
                      className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors ml-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {selectedTicket.messages.map((msg) => {
                    const isMe = msg.sender_type === 'tenant';
                    const msgAttachments = getMessageAttachments(msg.id);
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md'
                        }`}>
                          {!isMe && msg.sender_name && (
                            <p className="text-xs font-semibold mb-1 opacity-70">
                              {msg.sender_name} · Soporte Nivo
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>

                          {/* Attachments */}
                          {msgAttachments.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {msgAttachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={attachmentUrl(att.stored_name)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                                    isMe
                                      ? 'bg-white/10 hover:bg-white/20 text-primary-foreground'
                                      : 'bg-background/50 hover:bg-background/80 text-foreground'
                                  }`}
                                >
                                  {att.mime_type.startsWith('image/') ? (
                                    <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                  ) : (
                                    <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{att.original_name}</span>
                                  <span className="flex-shrink-0 opacity-60">{formatFileSize(att.size)}</span>
                                </a>
                              ))}
                            </div>
                          )}

                          <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply input */}
                {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' ? (
                  <div className="border-t px-4 py-3 bg-card">
                    {/* File previews */}
                    {replyFiles.length > 0 && (
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {replyFiles.map((file, i) => (
                          <div key={i} className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs">
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[120px]">{file.name}</span>
                            <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                            <button
                              onClick={() => removeFile(i)}
                              className="h-4 w-4 rounded-full hover:bg-background flex items-center justify-center"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-end gap-2">
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />

                      {/* Attach button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 flex-shrink-0"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={replyFiles.length >= 3}
                        title="Adjuntar imagen"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>

                      <Textarea
                        placeholder="Escribe tu mensaje..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleReplyKeyDown}
                        className="min-h-[44px] max-h-[120px] resize-none"
                        rows={1}
                      />

                      <Button
                        size="sm"
                        disabled={(!replyText.trim() && replyFiles.length === 0) || replying}
                        onClick={handleReply}
                        className="h-10 w-10 p-0 flex-shrink-0"
                      >
                        {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Enter para enviar · Shift+Enter para salto de línea · Hasta 3 imágenes
                    </p>
                  </div>
                ) : (
                  <div className="border-t px-4 py-3 text-center bg-card">
                    <p className="text-sm text-muted-foreground">
                      Este ticket está {selectedTicket.status === 'resolved' ? 'resuelto' : 'cerrado'}.
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        ) : (
          /* No ticket selected — empty state */
          <div className="flex-1 border rounded-xl bg-card flex items-center justify-center">
            <div className="text-center px-8">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">Selecciona un ticket</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Elige un ticket de la lista para ver la conversación, o crea uno nuevo.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <CreateTicketForm
            tenantName={tenant?.name || user?.name || ''}
            onCreated={(ticket) => {
              setCreateOpen(false);
              fetchTickets();
              openTicket(ticket.id);
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Create Ticket Form ─────────────────────────────────────────

function CreateTicketForm({
  tenantName,
  onCreated,
  onCancel,
}: {
  tenantName: string;
  onCreated: (ticket: Ticket) => void;
  onCancel: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [files, setFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter((f) => ALLOWED_IMAGE_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE);
    setFiles((prev) => [...prev, ...valid].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return;
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('message', message.trim());
      formData.append('category', category);
      formData.append('priority', priority);
      files.forEach((file) => formData.append('attachments', file));

      const res = await apiClient.post('/tenant-support/tickets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast({ title: 'Ticket creado', description: 'Nuestro equipo lo revisará pronto.' });
      onCreated(res.data);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo crear el ticket',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          Nuevo Ticket de Soporte
        </DialogTitle>
        <DialogDescription>
          Describe tu problema o consulta. Nuestro equipo te responderá lo antes posible.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Asunto <span className="text-red-500">*</span></label>
          <Input
            placeholder="Ej: No puedo cerrar la caja"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categoría</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prioridad</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className={cfg.color}>{cfg.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Mensaje <span className="text-red-500">*</span></label>
          <Textarea
            placeholder="Describe tu problema con el mayor detalle posible..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="resize-none"
          />
        </div>

        {/* Attachments */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Imágenes (opcional)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate max-w-[100px]">{file.name}</span>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="h-4 w-4 rounded-full hover:bg-background flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={files.length >= 3}
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Adjuntar imagen
          </Button>
          <p className="text-[10px] text-muted-foreground">Máximo 3 imágenes, 5 MB cada una</p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={creating}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!subject.trim() || !message.trim() || creating}
          className="gap-1.5"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Ticket
        </Button>
      </DialogFooter>
    </>
  );
}
