'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@nivo/ui';
import {
  Search, Plus, Eye, ClipboardCheck, ShoppingBag,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, X,
  Clock, XCircle, BarChart3, ScanLine, RefreshCw, Lock,
  Package, Play, Square, RotateCcw, ShieldCheck,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { formatCurrency, formatDate } from '@/lib/date-utils';

// ─── Types ───────────────────────────────────────────────────────

interface AuditRow {
  id: string;
  folio: string;
  branch_name: string;
  branch_id: string;
  type: string;
  status: string;
  branch_locked: boolean;
  created_by_name: string;
  closed_by_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  item_count: number;
}

interface AuditDetailItem {
  id: string;
  variant_id: string;
  location_id: string | null;
  location_name: string | null;
  expected_quantity: number;
  counted_quantity: number | null;
  difference: number | null;
  item_status: string;
  adjustment_reason: string | null;
  unit_cost: number;
  financial_impact: number | null;
  product_name: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  image_url: string | null;
}

interface AuditDetail {
  id: string;
  folio: string;
  branch_id: string;
  branch_name: string;
  type: string;
  status: string;
  branch_locked: boolean;
  filter_criteria: Record<string, string> | null;
  notes: string | null;
  created_by_name: string;
  closed_by_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  items: AuditDetailItem[];
}

interface CountingProgress {
  id: string;
  status: string;
  total_items: number;
  counted_items: number;
  pending_items: number;
  progress_percentage: number;
  items: {
    id: string;
    variant_id: string;
    product_name: string;
    sku: string;
    barcode: string | null;
    attributes: Record<string, string>;
    image_url: string | null;
    counted_quantity: number | null;
    item_status: string;
  }[];
}

interface Kpis {
  days_since_last_audit: number | null;
  accuracy_percentage: number | null;
  ytd_shrinkage: number;
}

const PAGE_SIZE = 20;

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  counting: { label: 'Contando', variant: 'default' },
  review: { label: 'En Revisión', variant: 'outline' },
  completed: { label: 'Completada', variant: 'default' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
};

const ADJUSTMENT_REASONS = [
  { value: 'shrinkage', label: 'Merma / Robo' },
  { value: 'damage', label: 'Defecto de fábrica' },
  { value: 'transfer_error', label: 'Error de traspaso' },
  { value: 'counting_error', label: 'Error previo de conteo' },
  { value: 'surplus', label: 'Sobrante encontrado' },
  { value: 'other', label: 'Otro' },
];

function ItemThumb({ src, size = 'sm' }: { src: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-16 w-16' : size === 'md' ? 'h-12 w-12' : 'h-8 w-8';
  if (!src) {
    return (
      <div className={`${dim} rounded bg-muted flex items-center justify-center flex-shrink-0`}>
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return <img src={src} alt="" className={`${dim} rounded object-cover flex-shrink-0`} />;
}

function variantLabel(attrs: Record<string, string>): string {
  return Object.values(attrs || {}).filter(Boolean).join(' · ') || '—';
}

// ═══════════════════════════════════════════════════════════════════
//  Main Page
// ═══════════════════════════════════════════════════════════════════

export default function AuditsPage() {
  const { selectedBranchId, isGeneralSelected, branches } = useBranchStore();

  // ─── View state ────────────────────────────────────────────────
  const [view, setView] = useState<'list' | 'counting' | 'review'>('list');
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null);

  // ─── KPIs ──────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<Kpis | null>(null);

  // ─── List ──────────────────────────────────────────────────────
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');

  // ─── Detail dialog ─────────────────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AuditDetail | null>(null);

  // ─── Create dialog ─────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────────

  const fetchKpis = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (!isGeneralSelected && selectedBranchId) params.branch_id = selectedBranchId;
      const res = await apiClient.get('/audits/kpis', { params });
      setKpis(res.data);
    } catch { setKpis(null); }
  }, [selectedBranchId, isGeneralSelected]);

  const fetchAudits = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (!isGeneralSelected && selectedBranchId) params.branch_id = selectedBranchId;
      if (statusFilter !== 'all') params.status = statusFilter;
      params.limit = String(PAGE_SIZE);
      params.offset = String(p * PAGE_SIZE);
      const res = await apiClient.get('/audits/list', { params });
      setAudits(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { setAudits([]); }
    finally { setLoading(false); }
  }, [selectedBranchId, isGeneralSelected, statusFilter]);

  useEffect(() => { fetchKpis(); fetchAudits(0); setPage(0); }, [fetchKpis, fetchAudits]);
  useEffect(() => { if (page > 0) fetchAudits(page); }, [page]);

  // ─── Open detail ───────────────────────────────────────────────

  const openDetail = async (auditId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiClient.get('/audits/detail', { params: { audit_id: auditId } });
      setDetail(res.data);
    } catch { /* */ }
    finally { setDetailLoading(false); }
  };

  // ─── Start Counting ────────────────────────────────────────────

  const startCounting = async (auditId: string, lockBranch: boolean) => {
    try {
      await apiClient.post('/audits/start-counting', { audit_id: auditId, lock_branch: lockBranch });
      setDetailOpen(false);
      setActiveAuditId(auditId);
      setView('counting');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al iniciar conteo');
    }
  };

  // ─── Enter review view ─────────────────────────────────────────

  const enterReview = (auditId: string) => {
    setActiveAuditId(auditId);
    setDetailOpen(false);
    setView('review');
  };

  // ─── Enter counting from list ──────────────────────────────────

  const enterCounting = (auditId: string) => {
    setActiveAuditId(auditId);
    setView('counting');
  };

  // ─── Cancel audit ──────────────────────────────────────────────

  const cancelAudit = async (auditId: string) => {
    try {
      await apiClient.post('/audits/cancel', { audit_id: auditId });
      setDetailOpen(false);
      fetchAudits(page);
      fetchKpis();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al cancelar');
    }
  };

  // ─── Back to list ──────────────────────────────────────────────

  const backToList = () => {
    setView('list');
    setActiveAuditId(null);
    fetchAudits(page);
    fetchKpis();
  };

  // ─── Created callback ─────────────────────────────────────────

  const onCreated = () => {
    setCreateOpen(false);
    fetchAudits(0);
    setPage(0);
  };

  // ═══════════════════════════════════════════════════════════════
  //  COUNTING VIEW
  // ═══════════════════════════════════════════════════════════════

  if (view === 'counting' && activeAuditId) {
    return <CountingView auditId={activeAuditId} onBack={backToList} onFinish={() => { setView('review'); }} />;
  }

  // ═══════════════════════════════════════════════════════════════
  //  REVIEW VIEW
  // ═══════════════════════════════════════════════════════════════

  if (view === 'review' && activeAuditId) {
    return <ReviewView auditId={activeAuditId} onBack={backToList} />;
  }

  // ═══════════════════════════════════════════════════════════════
  //  LIST VIEW
  // ═══════════════════════════════════════════════════════════════

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auditorías de Stock</h1>
          <p className="text-sm text-muted-foreground">Inventario físico, conteos cíclicos y conciliación</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva Auditoría
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Última Auditoría</p>
                <p className="text-2xl font-bold">
                  {kpis?.days_since_last_audit !== null ? `Hace ${kpis?.days_since_last_audit} días` : 'Nunca'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Precisión Histórica</p>
                <p className="text-2xl font-bold">
                  {kpis?.accuracy_percentage !== null ? `${kpis?.accuracy_percentage}%` : '—'}
                </p>
              </div>
              <ShieldCheck className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Merma Acumulada del Año</p>
                <p className={`text-2xl font-bold ${kpis && kpis.ytd_shrinkage < 0 ? 'text-destructive' : ''}`}>
                  {kpis ? formatCurrency(kpis.ytd_shrinkage) : '—'}
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${kpis && kpis.ytd_shrinkage < 0 ? 'text-destructive/30' : 'text-muted-foreground/30'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="counting">Contando</SelectItem>
            <SelectItem value="review">En Revisión</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Folio</th>
                  <th className="px-4 py-3 text-left font-medium">Sucursal</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-center font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Artículos</th>
                  <th className="px-4 py-3 text-left font-medium">Creador</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : audits.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No hay auditorías</td></tr>
                ) : (
                  audits.map((a) => {
                    const sc = statusConfig[a.status] || statusConfig.draft;
                    return (
                      <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium">
                          {a.folio}
                          {a.branch_locked && <Lock className="inline h-3 w-3 ml-1 text-destructive" />}
                        </td>
                        <td className="px-4 py-3">{a.branch_name}</td>
                        <td className="px-4 py-3">{a.type === 'full' ? 'Global' : 'Parcial'}</td>
                        <td className="px-4 py-3 text-center"><Badge variant={sc.variant}>{sc.label}</Badge></td>
                        <td className="px-4 py-3 text-right">{a.item_count}</td>
                        <td className="px-4 py-3">{a.created_by_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(a.created_at)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openDetail(a.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {a.status === 'counting' && (
                              <Button variant="ghost" size="sm" onClick={() => enterCounting(a.id)} title="Continuar conteo">
                                <ScanLine className="h-4 w-4" />
                              </Button>
                            )}
                            {a.status === 'review' && (
                              <Button variant="ghost" size="sm" onClick={() => enterReview(a.id)} title="Revisar discrepancias">
                                <ClipboardCheck className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">{total} auditorías</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Detail Dialog ═══════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail ? `${detail.folio} — ${detail.branch_name}` : 'Detalle'}</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.type === 'full' ? 'Auditoría Global' : 'Auditoría Parcial'} · ${detail.created_by_name}` : ''}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={statusConfig[detail.status]?.variant || 'secondary'}>
                  {statusConfig[detail.status]?.label || detail.status}
                </Badge>
                {detail.branch_locked && (
                  <Badge variant="destructive" className="gap-1">
                    <Lock className="h-3 w-3" /> Sucursal bloqueada
                  </Badge>
                )}
                {detail.started_at && (
                  <span className="text-sm text-muted-foreground">Inicio: {formatDate(detail.started_at)}</span>
                )}
                {detail.completed_at && (
                  <span className="text-sm text-muted-foreground">Cierre: {formatDate(detail.completed_at)}</span>
                )}
              </div>

              {detail.notes && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">{detail.notes}</p>
              )}

              {detail.status === 'completed' && detail.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-3 py-2 text-left font-medium">Artículo</th>
                        <th className="px-3 py-2 text-right font-medium">Sistema</th>
                        <th className="px-3 py-2 text-right font-medium">Conteo</th>
                        <th className="px-3 py-2 text-right font-medium">Diferencia</th>
                        <th className="px-3 py-2 text-right font-medium">Impacto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.filter((i) => i.difference !== 0).map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <ItemThumb src={item.image_url} />
                              <div>
                                <p className="font-medium text-xs">{item.product_name}</p>
                                <p className="text-xs text-muted-foreground">{variantLabel(item.attributes)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">{item.expected_quantity}</td>
                          <td className="px-3 py-2 text-right">{item.counted_quantity}</td>
                          <td className="px-3 py-2 text-right font-bold">
                            <span className={(item.difference ?? 0) < 0 ? 'text-destructive' : 'text-green-600'}>
                              {(item.difference ?? 0) > 0 ? '+' : ''}{item.difference}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            <span className={(item.financial_impact ?? 0) < 0 ? 'text-destructive' : 'text-green-600'}>
                              {formatCurrency(item.financial_impact ?? 0)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {detail && (
            <DialogFooter className="gap-2">
              {detail.status === 'draft' && (
                <>
                  <Button variant="destructive" size="sm" onClick={() => cancelAudit(detail.id)}>
                    <XCircle className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => startCounting(detail.id, false)}>
                    <Play className="h-4 w-4 mr-1" /> Iniciar sin bloqueo
                  </Button>
                  <Button size="sm" onClick={() => startCounting(detail.id, true)}>
                    <Lock className="h-4 w-4 mr-1" /> Iniciar y Bloquear
                  </Button>
                </>
              )}
              {detail.status === 'counting' && (
                <Button size="sm" onClick={() => enterCounting(detail.id)}>
                  <ScanLine className="h-4 w-4 mr-1" /> Ir a Conteo
                </Button>
              )}
              {detail.status === 'review' && (
                <Button size="sm" onClick={() => enterReview(detail.id)}>
                  <ClipboardCheck className="h-4 w-4 mr-1" /> Revisar Discrepancias
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Create Dialog ═══════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Auditoría</DialogTitle>
            <DialogDescription>Planifica un inventario físico para una sucursal.</DialogDescription>
          </DialogHeader>
          {createOpen && <CreateAuditForm onCreated={onCreated} onClose={() => setCreateOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  CREATE FORM
// ═══════════════════════════════════════════════════════════════════

function CreateAuditForm({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  const { selectedBranchId, branches } = useBranchStore();
  const [branchId, setBranchId] = useState(selectedBranchId || '');
  const [type, setType] = useState<'full' | 'partial'>('full');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const activeBranches = branches.filter((b) => b.is_active);

  const submit = async () => {
    if (!branchId) return;
    setSaving(true);
    try {
      await apiClient.post('/audits/create', {
        branch_id: branchId,
        type,
        notes: notes || undefined,
      });
      onCreated();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al crear auditoría');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal</label>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger><SelectValue placeholder="Seleccionar sucursal" /></SelectTrigger>
          <SelectContent>
            {activeBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de auditoría</label>
        <Select value={type} onValueChange={(v) => setType(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Global — Toda la tienda</SelectItem>
            <SelectItem value="partial">Parcial — Filtro específico</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas (opcional)</label>
        <Input value={notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} placeholder="Observaciones..." />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} disabled={!branchId || saving}>
          {saving ? 'Creando...' : 'Crear Auditoría'}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  COUNTING VIEW — Mobile-optimized blind count
// ═══════════════════════════════════════════════════════════════════

function CountingView({
  auditId,
  onBack,
  onFinish,
}: {
  auditId: string;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [progress, setProgress] = useState<CountingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [barcode, setBarcode] = useState('');
  const [lastScan, setLastScan] = useState<{ product_name: string; sku: string; attributes: Record<string, string>; image_url: string | null; counted_quantity: number } | null>(null);
  const [scanError, setScanError] = useState('');
  const [manualQty, setManualQty] = useState('');
  const [manualVariantId, setManualVariantId] = useState('');
  const [finishing, setFinishing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await apiClient.get('/audits/counting-progress', { params: { audit_id: auditId } });
      setProgress(res.data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [auditId]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  // Auto-focus scan input
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(timer);
  }, [lastScan]);

  const handleScan = async () => {
    if (!barcode.trim()) return;
    setScanError('');
    try {
      const res = await apiClient.post('/audits/scan', { audit_id: auditId, barcode: barcode.trim() });
      setLastScan({
        product_name: res.data.product_name,
        sku: res.data.sku,
        attributes: res.data.attributes,
        image_url: res.data.image_url,
        counted_quantity: res.data.counted_quantity,
      });
      setManualVariantId(res.data.variant_id);
      setManualQty('');
      setBarcode('');
      fetchProgress();
    } catch (error: any) {
      setScanError(error.response?.data?.message || 'Código no encontrado');
      setLastScan(null);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualVariantId || !manualQty) return;
    const qty = parseInt(manualQty);
    if (isNaN(qty) || qty < 0) return;
    try {
      await apiClient.post('/audits/submit-count', {
        audit_id: auditId,
        variant_id: manualVariantId,
        counted_quantity: qty,
      });
      setLastScan((prev) => prev ? { ...prev, counted_quantity: qty } : null);
      setManualQty('');
      fetchProgress();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error');
    }
  };

  const handleFinishCounting = async () => {
    setFinishing(true);
    try {
      await apiClient.post('/audits/finish-counting', { audit_id: auditId });
      onFinish();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al finalizar conteo');
    } finally { setFinishing(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleScan();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Volver
        </Button>
        <h2 className="text-lg font-bold">Conteo Físico</h2>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleFinishCounting}
          disabled={finishing}
        >
          <Square className="h-4 w-4 mr-1" />
          {finishing ? 'Finalizando...' : 'Finalizar'}
        </Button>
      </div>

      {/* Progress bar */}
      {progress && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-bold">{progress.counted_items} / {progress.total_items}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary rounded-full h-3 transition-all"
                style={{ width: `${progress.progress_percentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">{progress.progress_percentage}% completado</p>
          </CardContent>
        </Card>
      )}

      {/* SCAN INPUT — Giant for mobile */}
      <Card className="border-2 border-primary">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-primary flex-shrink-0" />
            <h3 className="font-bold text-lg">Escanear Código</h3>
          </div>
          <Input
            ref={inputRef}
            className="text-xl h-14 text-center font-mono"
            placeholder="Escanear o teclear código..."
            value={barcode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Button className="w-full h-12 text-lg" onClick={handleScan} disabled={!barcode.trim()}>
            <ScanLine className="h-5 w-5 mr-2" />
            Registrar
          </Button>

          {scanError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {scanError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last scan result */}
      {lastScan && (
        <Card className="border-green-300 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <ItemThumb src={lastScan.image_url} size="lg" />
              <div className="flex-1">
                <p className="font-bold">{lastScan.product_name}</p>
                <p className="text-sm text-muted-foreground">{variantLabel(lastScan.attributes)} · {lastScan.sku}</p>
                <p className="text-2xl font-bold mt-1">Has contado: {lastScan.counted_quantity}</p>
              </div>
            </div>

            {/* Quick quantity override */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-muted-foreground">Ajustar cantidad:</span>
              <Input
                className="w-20 h-9 text-center font-mono"
                type="number"
                min={0}
                placeholder="Qty"
                value={manualQty}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualQty(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={handleManualSubmit} disabled={!manualQty}>
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recently counted items */}
      {progress && progress.items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Artículos contados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-60 overflow-y-auto">
              {progress.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                  <ItemThumb src={item.image_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">{variantLabel(item.attributes)}</p>
                  </div>
                  <span className="font-mono font-bold text-sm">{item.counted_quantity}</span>
                  {item.item_status === 'recount' && (
                    <Badge variant="destructive" className="text-xs">Reconteo</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  REVIEW VIEW — Discrepancy Matrix
// ═══════════════════════════════════════════════════════════════════

function ReviewView({ auditId, onBack }: { auditId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState('shrinkage');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/audits/detail', { params: { audit_id: auditId } });
      setDetail(res.data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [auditId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const requestRecount = async (itemId: string) => {
    try {
      await apiClient.post('/audits/request-recount', { item_id: itemId });
      fetchDetail();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error');
    }
  };

  const openReasonDialog = (itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedReason('shrinkage');
    setReasonDialogOpen(true);
  };

  const confirmAcceptDiscrepancy = async () => {
    if (!selectedItemId) return;
    try {
      await apiClient.post('/audits/accept-discrepancy', { item_id: selectedItemId, reason: selectedReason });
      setReasonDialogOpen(false);
      fetchDetail();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error');
    }
  };

  const handleCloseAndApply = async () => {
    setClosing(true);
    try {
      await apiClient.post('/audits/close-and-apply', { audit_id: auditId });
      onBack();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al cerrar auditoría');
    } finally { setClosing(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) return null;

  // Separate items: discrepancies vs matches
  const discrepancies = detail.items.filter((i) => i.difference !== null && i.difference !== 0);
  const matches = detail.items.filter((i) => i.difference === 0);
  const unresolvedCount = discrepancies.filter((i) => i.item_status !== 'accepted').length;
  const hasRecountItems = detail.items.some((i) => i.item_status === 'recount');

  const totalShrinkage = discrepancies
    .filter((i) => i.item_status === 'accepted')
    .reduce((sum, i) => sum + (i.financial_impact ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <div>
            <h2 className="text-xl font-bold">{detail.folio} — Revisión de Discrepancias</h2>
            <p className="text-sm text-muted-foreground">{detail.branch_name}</p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={handleCloseAndApply}
          disabled={closing || unresolvedCount > 0 || hasRecountItems}
        >
          {closing ? 'Aplicando...' : (
            <>
              <ShieldCheck className="h-4 w-4 mr-1" />
              Cerrar y Aplicar Auditoría
            </>
          )}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">Total artículos</p>
            <p className="text-2xl font-bold">{detail.items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">Coinciden</p>
            <p className="text-2xl font-bold text-green-600">{matches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">Discrepancias</p>
            <p className="text-2xl font-bold text-destructive">{discrepancies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-sm text-muted-foreground">Impacto financiero</p>
            <p className={`text-2xl font-bold font-mono ${totalShrinkage < 0 ? 'text-destructive' : ''}`}>
              {formatCurrency(totalShrinkage)}
            </p>
          </CardContent>
        </Card>
      </div>

      {unresolvedCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm">
            <strong>{unresolvedCount}</strong> discrepancia(s) sin resolver. Acepte o solicite reconteo para cada una antes de cerrar.
          </p>
        </div>
      )}

      {hasRecountItems && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-300 rounded-lg p-3 flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <p className="text-sm">
            Hay artículos pendientes de reconteo. La auditoría volvió a fase de conteo para esos artículos.
          </p>
        </div>
      )}

      {/* Discrepancy table */}
      {discrepancies.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Discrepancias</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Artículo</th>
                    <th className="px-4 py-3 text-right font-medium">Sistema</th>
                    <th className="px-4 py-3 text-right font-medium">Conteo</th>
                    <th className="px-4 py-3 text-right font-medium">Diferencia</th>
                    <th className="px-4 py-3 text-right font-medium">Pérdida</th>
                    <th className="px-4 py-3 text-center font-medium">Estado</th>
                    <th className="px-4 py-3 text-center font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {discrepancies.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b last:border-0 ${
                        item.item_status === 'accepted' ? 'bg-muted/20 opacity-70' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ItemThumb src={item.image_url} size="md" />
                          <div>
                            <p className="font-medium text-xs">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">{variantLabel(item.attributes)} · {item.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">{item.expected_quantity}</td>
                      <td className="px-4 py-3 text-right font-bold">{item.counted_quantity}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold text-lg ${(item.difference ?? 0) < 0 ? 'text-destructive' : 'text-green-600'}`}>
                          {(item.difference ?? 0) > 0 ? '+' : ''}{item.difference}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={(item.financial_impact ?? 0) < 0 ? 'text-destructive' : 'text-green-600'}>
                          {formatCurrency(item.financial_impact ?? 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.item_status === 'accepted' ? (
                          <Badge variant="secondary" className="text-xs">
                            {ADJUSTMENT_REASONS.find((r) => r.value === item.adjustment_reason)?.label || item.adjustment_reason}
                          </Badge>
                        ) : item.item_status === 'recount' ? (
                          <Badge variant="outline" className="text-xs">Reconteo</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">Pendiente</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.item_status !== 'accepted' && item.item_status !== 'recount' && (
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => requestRecount(item.id)} title="Solicitar reconteo">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openReasonDialog(item.id)} title="Aceptar diferencia">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Matches (collapsed) */}
      {matches.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-green-700">
              <CheckCircle2 className="inline h-4 w-4 mr-1" />
              Sin diferencias ({matches.length} artículos)
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* ═══ Reason Dialog ═══════════════════════════════════════ */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aceptar Diferencia</DialogTitle>
            <DialogDescription>Seleccione el motivo de la discrepancia para el registro contable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReasonDialogOpen(false)}>Cancelar</Button>
              <Button onClick={confirmAcceptDiscrepancy}>Aceptar Merma</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
