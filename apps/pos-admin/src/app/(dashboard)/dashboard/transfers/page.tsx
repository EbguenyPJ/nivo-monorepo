'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@nivo/ui';
import {
  ArrowLeftRight, Search, Plus, Eye, Truck, Package, PackageCheck,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, X, Minus,
  ShoppingBag, Clock, Send, XCircle, RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { formatCurrency, formatDate } from '@/lib/date-utils';

// ─── Types ───────────────────────────────────────────────────────

interface TransferRow {
  id: string;
  folio: string;
  status: string;
  origin_branch_name: string;
  origin_branch_id: string;
  destination_branch_name: string;
  destination_branch_id: string;
  created_by_name: string;
  received_by_name: string | null;
  shipped_at: string | null;
  received_at: string | null;
  notes: string | null;
  discrepancy_notes: string | null;
  created_at: string;
}

interface TransferDetailItem {
  id: string;
  variant_id: string;
  sent_quantity: number;
  received_quantity: number | null;
  difference: number | null;
  product_name: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  image_url: string | null;
}

interface TransferDetail {
  id: string;
  folio: string;
  status: string;
  origin_branch_id: string;
  origin_branch_name: string;
  destination_branch_id: string;
  destination_branch_name: string;
  created_by_name: string;
  received_by_name: string | null;
  shipped_at: string | null;
  received_at: string | null;
  notes: string | null;
  discrepancy_notes: string | null;
  created_at: string;
  items: TransferDetailItem[];
}

interface VariantSearchResult {
  variant_id: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  product_name: string;
  image_url: string | null;
  stock_available: number;
}

interface NewTransferItem {
  variant_id: string;
  product_name: string;
  sku: string;
  attributes: Record<string, string>;
  image_url: string | null;
  stock_available: number;
  quantity: number;
}

// ─── Constants ───────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  in_transit: 'En Tránsito',
  completed: 'Completado',
  discrepancy: 'Con Diferencias',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'border-slate-500/30 text-slate-400 bg-slate-500/10',
  in_transit: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
  completed: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  discrepancy: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
  cancelled: 'border-red-500/30 text-red-400 bg-red-500/10',
};

const PAGE_SIZE = 15;

// ─── Main Page ───────────────────────────────────────────────────

export default function TransfersPage() {
  const { selectedBranchId, isGeneralSelected, branches } = useBranchStore();
  const [activeTab, setActiveTab] = useState('sent');

  // List
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  // Reception dialog
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [receptionTransfer, setReceptionTransfer] = useState<TransferDetail | null>(null);
  const [receptionQtys, setReceptionQtys] = useState<Record<string, number>>({});
  const [receptionProcessing, setReceptionProcessing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ─── Fetch Transfers ───────────────────────────────────────────

  const fetchTransfers = useCallback(async (currentPage = 0) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { tab: activeTab };
      if (!isGeneralSelected && selectedBranchId) params.branch_id = selectedBranchId;
      params.limit = String(PAGE_SIZE);
      params.offset = String(currentPage * PAGE_SIZE);

      const res = await apiClient.get('/products/inventory/transfers/list', { params });
      setTransfers(res.data.data || []);
      setTotalCount(res.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch transfers:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedBranchId, isGeneralSelected]);

  useEffect(() => {
    setPage(0);
    fetchTransfers(0);
  }, [fetchTransfers]);

  useEffect(() => {
    if (page > 0) fetchTransfers(page);
  }, [page]);

  // ─── Detail ────────────────────────────────────────────────────

  const openDetail = async (transferId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiClient.get('/products/inventory/transfers/detail', { params: { transfer_id: transferId } });
      setDetail(res.data);
    } catch (error) {
      console.error('Failed to fetch transfer detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Reception ─────────────────────────────────────────────────

  const openReception = async (transferId: string) => {
    setReceptionOpen(true);
    setDetailLoading(true);
    setReceptionTransfer(null);
    try {
      const res = await apiClient.get('/products/inventory/transfers/detail', { params: { transfer_id: transferId } });
      setReceptionTransfer(res.data);
      const qtys: Record<string, number> = {};
      for (const item of res.data.items) {
        qtys[item.id] = 0;
      }
      setReceptionQtys(qtys);
    } catch (error) {
      console.error('Failed to fetch transfer detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReception = async () => {
    if (!receptionTransfer) return;
    setReceptionProcessing(true);
    try {
      await apiClient.post('/products/inventory/transfers/receive', {
        transfer_id: receptionTransfer.id,
        items: receptionTransfer.items.map((item) => ({
          item_id: item.id,
          received_quantity: receptionQtys[item.id] ?? 0,
        })),
      });
      setReceptionOpen(false);
      fetchTransfers(page);
    } catch (error: any) {
      console.error('Reception failed:', error);
      alert(error.response?.data?.message || 'Error al recibir traspaso');
    } finally {
      setReceptionProcessing(false);
    }
  };

  // ─── Dispatch ──────────────────────────────────────────────────

  const dispatchTransfer = async (transferId: string) => {
    try {
      await apiClient.post('/products/inventory/transfers/dispatch', { transfer_id: transferId });
      setDetailOpen(false);
      fetchTransfers(page);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al despachar');
    }
  };

  const cancelTransfer = async (transferId: string) => {
    try {
      await apiClient.post('/products/inventory/transfers/cancel', { transfer_id: transferId });
      setDetailOpen(false);
      fetchTransfers(page);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al cancelar');
    }
  };

  // ─── Create callback ──────────────────────────────────────────

  const onTransferCreated = () => {
    setCreateOpen(false);
    fetchTransfers(0);
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Traspasos entre Sucursales</h2>
          <p className="text-muted-foreground">Envía, recibe y rastrea mercancía entre sucursales</p>
        </div>
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo Traspaso
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sent" className="gap-1.5">
            <Send className="h-4 w-4" />
            Enviados
          </TabsTrigger>
          <TabsTrigger value="incoming" className="gap-1.5">
            <Package className="h-4 w-4" />
            Por Recibir
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {activeTab === 'sent' && 'Traspasos Enviados'}
                  {activeTab === 'incoming' && 'Traspasos por Recibir'}
                  {activeTab === 'history' && 'Historial de Traspasos'}
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fetchTransfers(page)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : transfers.length === 0 ? (
                <div className="py-12 text-center">
                  <ArrowLeftRight className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">No hay traspasos en esta vista.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 font-medium text-muted-foreground">Folio</th>
                          <th className="pb-3 font-medium text-muted-foreground">Estado</th>
                          <th className="pb-3 font-medium text-muted-foreground">Origen</th>
                          <th className="pb-3 font-medium text-muted-foreground">Destino</th>
                          <th className="pb-3 font-medium text-muted-foreground">Creado por</th>
                          <th className="pb-3 font-medium text-muted-foreground">Fecha</th>
                          <th className="pb-3 font-medium text-muted-foreground text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfers.map((t) => (
                          <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                            <td className="py-3 font-mono font-bold text-xs">{t.folio}</td>
                            <td className="py-3">
                              <Badge variant="outline" className={STATUS_COLORS[t.status] || ''}>
                                {STATUS_LABELS[t.status] || t.status}
                              </Badge>
                            </td>
                            <td className="py-3">{t.origin_branch_name}</td>
                            <td className="py-3">{t.destination_branch_name}</td>
                            <td className="py-3 text-muted-foreground">{t.created_by_name}</td>
                            <td className="py-3 text-muted-foreground">{formatDate(t.created_at)}</td>
                            <td className="py-3 text-right">
                              {activeTab === 'incoming' && t.status === 'in_transit' ? (
                                <Button variant="default" size="sm" className="gap-1 h-8" onClick={() => openReception(t.id)}>
                                  <PackageCheck className="h-3.5 w-3.5" />
                                  Recibir
                                </Button>
                              ) : (
                                <Button variant="ghost" size="sm" className="gap-1 h-8" onClick={() => openDetail(t.id)}>
                                  <Eye className="h-3.5 w-3.5" />
                                  Ver
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {page + 1} de {totalPages}
                      </span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Detail Dialog ────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="space-y-4 py-8">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : detail ? (
            <TransferDetailView
              detail={detail}
              onDispatch={() => dispatchTransfer(detail.id)}
              onCancel={() => cancelTransfer(detail.id)}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Error al cargar.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Create Dialog ────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <CreateTransferFlow onCreated={onTransferCreated} onClose={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* ─── Reception Dialog ─────────────────────────────────── */}
      <Dialog open={receptionOpen} onOpenChange={setReceptionOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="space-y-4 py-8">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : receptionTransfer ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-blue-400" />
                  Recepción — {receptionTransfer.folio}
                </DialogTitle>
                <DialogDescription>
                  De: {receptionTransfer.origin_branch_name} — Cuenta lo que recibiste físicamente
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                {receptionTransfer.items.map((item) => {
                  const received = receptionQtys[item.id] ?? 0;
                  const matches = received === item.sent_quantity;
                  const hasShortage = received < item.sent_quantity && received > 0;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 border rounded-lg p-3 transition-colors ${
                        matches ? 'border-emerald-500/30 bg-emerald-500/5' :
                        hasShortage ? 'border-red-500/30 bg-red-500/5' : ''
                      }`}
                    >
                      <ItemThumb url={item.image_url} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.sku} · Enviado: <strong>{item.sent_quantity}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline" size="sm" className="h-8 w-8 p-0"
                          disabled={received <= 0}
                          onClick={() => setReceptionQtys((p) => ({ ...p, [item.id]: Math.max(0, received - 1) }))}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          className="w-16 h-8 text-center tabular-nums"
                          type="number"
                          min={0}
                          value={received}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setReceptionQtys((p) => ({ ...p, [item.id]: Math.max(0, parseInt(e.target.value) || 0) }))
                          }
                        />
                        <Button
                          variant="outline" size="sm" className="h-8 w-8 p-0"
                          onClick={() => setReceptionQtys((p) => ({ ...p, [item.id]: received + 1 }))}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="w-8 flex-shrink-0 text-center">
                        {matches && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                        {hasShortage && <AlertTriangle className="h-5 w-5 text-red-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setReceptionOpen(false)}>Cancelar</Button>
                <Button onClick={submitReception} disabled={receptionProcessing} className="gap-1.5">
                  {receptionProcessing ? 'Procesando...' : (
                    <>
                      <PackageCheck className="h-4 w-4" />
                      Completar Recepción
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Error al cargar.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Transfer Detail View ────────────────────────────────────────

function TransferDetailView({
  detail, onDispatch, onCancel,
}: {
  detail: TransferDetail;
  onDispatch: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          Traspaso {detail.folio}
        </DialogTitle>
        <DialogDescription>
          <Badge variant="outline" className={STATUS_COLORS[detail.status] || ''}>
            {STATUS_LABELS[detail.status] || detail.status}
          </Badge>
        </DialogDescription>
      </DialogHeader>

      {/* Info */}
      <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3">
        <div>
          <p className="text-muted-foreground text-xs">Origen</p>
          <p className="font-medium">{detail.origin_branch_name}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Destino</p>
          <p className="font-medium">{detail.destination_branch_name}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Creado por</p>
          <p className="font-medium">{detail.created_by_name}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Fecha creación</p>
          <p className="font-medium">{formatDate(detail.created_at)}</p>
        </div>
        {detail.shipped_at && (
          <div>
            <p className="text-muted-foreground text-xs">Despachado</p>
            <p className="font-medium">{formatDate(detail.shipped_at)}</p>
          </div>
        )}
        {detail.received_by_name && (
          <div>
            <p className="text-muted-foreground text-xs">Recibido por</p>
            <p className="font-medium">{detail.received_by_name}</p>
          </div>
        )}
        {detail.received_at && (
          <div>
            <p className="text-muted-foreground text-xs">Recepción</p>
            <p className="font-medium">{formatDate(detail.received_at)}</p>
          </div>
        )}
        {detail.notes && (
          <div className="col-span-2">
            <p className="text-muted-foreground text-xs">Notas</p>
            <p className="text-sm">{detail.notes}</p>
          </div>
        )}
      </div>

      {/* Discrepancy alert */}
      {detail.discrepancy_notes && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm">
          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-orange-400">Diferencias detectadas</p>
            <pre className="text-xs text-orange-300/80 whitespace-pre-wrap mt-1">{detail.discrepancy_notes}</pre>
          </div>
        </div>
      )}

      {/* Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            Artículos ({detail.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {detail.items.map((item) => {
            const attrs = item.attributes;
            const variantLabel = [attrs?.Color, attrs?.['Talla MX'] || attrs?.size].filter(Boolean).join(' / ');
            return (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                <ItemThumb url={item.image_url} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {variantLabel && <span>{variantLabel} · </span>}
                    {item.sku}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 text-sm">
                  <p className="tabular-nums">Enviado: <strong>{item.sent_quantity}</strong></p>
                  {item.received_quantity !== null && (
                    <p className={`tabular-nums text-xs ${item.difference === 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      Recibido: {item.received_quantity}
                      {item.difference !== 0 && ` (${item.difference! > 0 ? '+' : ''}${item.difference})`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions for draft */}
      {detail.status === 'draft' && (
        <DialogFooter className="gap-2">
          <Button variant="outline" className="gap-1.5" onClick={onCancel}>
            <XCircle className="h-4 w-4" />
            Cancelar Traspaso
          </Button>
          <Button className="gap-1.5" onClick={onDispatch}>
            <Truck className="h-4 w-4" />
            Despachar Traspaso
          </Button>
        </DialogFooter>
      )}
    </>
  );
}

// ─── Create Transfer Flow ────────────────────────────────────────

function CreateTransferFlow({
  onCreated, onClose,
}: {
  onCreated: () => void;
  onClose: () => void;
}) {
  const { selectedBranchId, branches } = useBranchStore();
  const [destinationBranchId, setDestinationBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<NewTransferItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<VariantSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const originBranchId = selectedBranchId || '';
  const otherBranches = branches.filter((b) => b.is_active && b.id !== originBranchId);

  // Search variants
  const doSearch = useCallback(async (q: string) => {
    if (!originBranchId) return;
    setSearching(true);
    try {
      const res = await apiClient.get('/products/inventory/transfers/search-variants', {
        params: { branch_id: originBranchId, search: q },
      });
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [originBranchId]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(value), 300);
  };

  // Add item
  const addItem = (variant: VariantSearchResult) => {
    const existing = items.find((i) => i.variant_id === variant.variant_id);
    if (existing) {
      if (existing.quantity < variant.stock_available) {
        setItems((prev) =>
          prev.map((i) => i.variant_id === variant.variant_id ? { ...i, quantity: i.quantity + 1 } : i),
        );
      }
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        variant_id: variant.variant_id,
        product_name: variant.product_name,
        sku: variant.sku,
        attributes: variant.attributes,
        image_url: variant.image_url,
        stock_available: variant.stock_available,
        quantity: 1,
      },
    ]);
  };

  const updateItemQty = (variantId: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.variant_id !== variantId) return i;
        const newQty = Math.max(1, Math.min(i.stock_available, i.quantity + delta));
        return { ...i, quantity: newQty };
      }),
    );
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  const submit = async () => {
    if (!destinationBranchId || items.length === 0) return;
    setSubmitting(true);
    try {
      const createRes = await apiClient.post('/products/inventory/transfers/create', {
        origin_branch_id: originBranchId,
        destination_branch_id: destinationBranchId,
        notes: notes || undefined,
        items: items.map((i) => ({ variant_id: i.variant_id, sent_quantity: i.quantity })),
      });
      // Auto-dispatch after creation
      const transferId = createRes.data?.id;
      if (transferId) {
        await apiClient.post('/products/inventory/transfers/dispatch', { transfer_id: transferId });
      }
      onCreated();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al crear traspaso');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nuevo Traspaso
        </DialogTitle>
        <DialogDescription>
          Selecciona destino, escanea artículos y despacha.
        </DialogDescription>
      </DialogHeader>

      {/* Destination selector */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Sucursal Destino</label>
          <Select value={destinationBranchId} onValueChange={setDestinationBranchId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona sucursal destino" />
            </SelectTrigger>
            <SelectContent>
              {otherBranches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Item search */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Buscar Artículos</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Escanea código o busca por nombre / SKU..."
              className="pl-10"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
              autoFocus
            />
          </div>
          {/* Search results */}
          {search && (
            <div className="border rounded-lg mt-1 max-h-48 overflow-y-auto">
              {searching ? (
                <p className="text-xs text-muted-foreground p-3 text-center">Buscando...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">Sin resultados</p>
              ) : (
                searchResults.map((v) => {
                  const alreadyAdded = items.find((i) => i.variant_id === v.variant_id);
                  return (
                    <button
                      key={v.variant_id}
                      className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left text-sm border-b last:border-0"
                      onClick={() => addItem(v)}
                    >
                      <ItemThumb url={v.image_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{v.product_name}</p>
                        <p className="text-xs text-muted-foreground">{v.sku} · Stock: {v.stock_available}</p>
                      </div>
                      {alreadyAdded && (
                        <Badge variant="secondary" className="text-xs">x{alreadyAdded.quantity}</Badge>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Selected items */}
        {items.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Artículos a enviar ({items.length})</p>
            {items.map((item) => (
              <div key={item.variant_id} className="flex items-center gap-3 border rounded-lg p-2">
                <ItemThumb url={item.image_url} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} · Stock: {item.stock_available}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateItemQty(item.variant_id, -1)} disabled={item.quantity <= 1}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-bold tabular-nums text-sm">{item.quantity}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateItemQty(item.variant_id, 1)} disabled={item.quantity >= item.stock_available}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeItem(item.variant_id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Notas (opcional)</label>
          <Input
            placeholder="Ej: Envío con transportista local"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={submit}
          disabled={!destinationBranchId || items.length === 0 || submitting}
          className="gap-1.5"
        >
          {submitting ? 'Creando...' : (
            <>
              <Truck className="h-4 w-4" />
              Crear y Despachar
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

// ─── Shared Components ───────────────────────────────────────────

function ItemThumb({ url, size = 'md' }: { url: string | null; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  if (!url) {
    return (
      <div className={`${cls} rounded-lg bg-muted flex items-center justify-center flex-shrink-0`}>
        <ShoppingBag className={`${size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-muted-foreground`} />
      </div>
    );
  }
  return (
    <img
      src={url} alt=""
      className={`${cls} rounded-lg object-cover flex-shrink-0 bg-muted`}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}
