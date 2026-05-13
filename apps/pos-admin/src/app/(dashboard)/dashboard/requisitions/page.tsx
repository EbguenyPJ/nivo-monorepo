'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  toast,
} from '@nivo/ui';
import {
  ClipboardList, RefreshCw, Lock, Unlock, CheckCircle2, Package,
  Loader2, ChevronDown, ChevronRight, AlertTriangle, Truck,
  FileText, ArrowRight, Search, Plus, Minus, Trash2, Edit3,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore, GENERAL_BRANCH_ID } from '@/store/branchStore';

// ─── Types ───────────────────────────────────────────────────────

interface RequisitionItem {
  id: string;
  variant_id: string;
  suggested_quantity: number;
  override_quantity: number | null;
  current_stock: number;
  max_stock: number;
  estimated_cost: number;
  supplier_id: string | null;
  supplier_sku: string | null;
  supplier?: { id: string; name: string } | null;
  variant: {
    id: string;
    sku: string;
    attributes: Record<string, string>;
    cost: number;
    images: string[];
    product: { id: string; name: string; images: string[] };
  };
}

interface Requisition {
  id: string;
  folio_number: number;
  branch_id: string;
  status: 'draft' | 'locked' | 'approved';
  total_estimated_cost: number;
  total_items: number;
  notes: string | null;
  locked_by?: { name: string } | null;
  locked_at: string | null;
  approved_by?: { name: string } | null;
  approved_at: string | null;
  branch?: { id: string; name: string } | null;
  items: RequisitionItem[];
  item_count?: number;
  created_at: string;
  updated_at: string;
}

interface Kpis {
  drafts: number;
  locked: number;
  approved: number;
  below_minimum: number;
}

// ─── Constants ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Borrador', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: <Edit3 className="h-3 w-3" /> },
  locked: { label: 'En Revisión', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: <Lock className="h-3 w-3" /> },
  approved: { label: 'Aprobada', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: <CheckCircle2 className="h-3 w-3" /> },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function variantLabel(item: RequisitionItem) {
  const attrs = item.variant?.attributes || {};
  return Object.values(attrs).join(' / ') || item.variant?.sku || '-';
}

function productImage(item: RequisitionItem) {
  return item.variant?.images?.[0] || item.variant?.product?.images?.[0] || null;
}

// ─── Page ────────────────────────────────────────────────────────

export default function RequisitionsPage() {
  const { selectedBranchId, isGeneralSelected } = useBranchStore();

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Detail view
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // State transitions
  const [transitioning, setTransitioning] = useState(false);

  // Approval result dialog
  const [approvalResult, setApprovalResult] = useState<{ requisition: Requisition; purchase_orders: any[] } | null>(null);

  const branchId = isGeneralSelected ? undefined : selectedBranchId;

  // ─── Fetch data ───────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (branchId) params.branch_id = branchId;

      const [kpiRes, listRes] = await Promise.all([
        apiClient.get('/requisitions/kpis', { params }),
        apiClient.get('/requisitions', { params: { ...params, limit: '50' } }),
      ]);
      setKpis(kpiRes.data);
      setRequisitions(listRes.data.data || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las requisiciones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Open detail ──────────────────────────────────────────────

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await apiClient.get(`/requisitions/${id}`);
      setSelectedReq(res.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la requisición', variant: 'destructive' });
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Generate draft from stock scan ───────────────────────────

  const handleGenerate = async () => {
    if (!branchId) {
      toast({ title: 'Selecciona una sucursal', description: 'Elige una sucursal específica para generar requisición.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const res = await apiClient.post('/requisitions/generate', { branch_id: branchId });
      toast({
        title: 'Requisición generada',
        description: `Se evaluaron ${res.data.total_below_min || 0} productos bajo mínimo. ${res.data.items_added || 0} nuevos ítems agregados.`,
      });
      fetchData();
      if (res.data.draft_id) openDetail(res.data.draft_id);
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al generar requisición', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ─── State transitions ────────────────────────────────────────

  const handleLock = async () => {
    if (!selectedReq) return;
    setTransitioning(true);
    try {
      const res = await apiClient.patch(`/requisitions/${selectedReq.id}/lock`);
      setSelectedReq(res.data);
      fetchData();
      toast({ title: 'Requisición bloqueada', description: 'La requisición está lista para revisión.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || err.message, variant: 'destructive' });
    } finally {
      setTransitioning(false);
    }
  };

  const handleUnlock = async () => {
    if (!selectedReq) return;
    setTransitioning(true);
    try {
      const res = await apiClient.patch(`/requisitions/${selectedReq.id}/unlock`);
      setSelectedReq(res.data);
      fetchData();
      toast({ title: 'Desbloqueada', description: 'La requisición vuelve a modo borrador.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || err.message, variant: 'destructive' });
    } finally {
      setTransitioning(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedReq) return;
    setTransitioning(true);
    try {
      const res = await apiClient.patch(`/requisitions/${selectedReq.id}/approve`);
      setApprovalResult(res.data);
      setSelectedReq(res.data.requisition);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || err.message, variant: 'destructive' });
    } finally {
      setTransitioning(false);
    }
  };

  // ─── Update item quantity ─────────────────────────────────────

  const handleUpdateItem = async (itemId: string, overrideQty: number | null) => {
    if (!selectedReq) return;
    try {
      const res = await apiClient.patch(`/requisitions/${selectedReq.id}/items/${itemId}`, {
        override_quantity: overrideQty,
      });
      setSelectedReq(res.data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedReq) return;
    try {
      const res = await apiClient.delete(`/requisitions/${selectedReq.id}/items/${itemId}`);
      setSelectedReq(res.data);
      fetchData();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    }
  };

  // ─── Render: Detail view ──────────────────────────────────────

  if (selectedReq) {
    const statusCfg = STATUS_CONFIG[selectedReq.status] || STATUS_CONFIG.draft;
    const isDraft = selectedReq.status === 'draft';
    const isLocked = selectedReq.status === 'locked';
    const isApproved = selectedReq.status === 'approved';

    // Group items by supplier
    const supplierGroups = new Map<string, RequisitionItem[]>();
    const noSupplierItems: RequisitionItem[] = [];

    for (const item of (selectedReq.items || [])) {
      if (item.supplier_id && item.supplier) {
        const key = item.supplier_id;
        const group = supplierGroups.get(key) || [];
        group.push(item);
        supplierGroups.set(key, group);
      } else {
        noSupplierItems.push(item);
      }
    }

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedReq(null); fetchData(); }}>
              <ChevronRight className="h-4 w-4 rotate-180" />
              Volver
            </Button>
            <div>
              <h2 className="text-xl font-bold">
                REQ-{String(selectedReq.folio_number).padStart(4, '0')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedReq.branch?.name} · Creada {formatDate(selectedReq.created_at)}
              </p>
            </div>
            <Badge className={`gap-1 ${statusCfg.color} border`}>
              {statusCfg.icon}
              {statusCfg.label}
            </Badge>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isDraft && (
              <Button onClick={handleLock} disabled={transitioning || (selectedReq.items?.length || 0) === 0} className="gap-1.5">
                {transitioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Bloquear para Revisión
              </Button>
            )}
            {isLocked && (
              <>
                <Button variant="outline" onClick={handleUnlock} disabled={transitioning} className="gap-1.5">
                  <Unlock className="h-4 w-4" />
                  Desbloquear
                </Button>
                <Button onClick={handleApprove} disabled={transitioning} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  {transitioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Aprobar y Generar OC
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{selectedReq.total_items}</p>
              <p className="text-xs text-muted-foreground">Productos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{formatCurrency(Number(selectedReq.total_estimated_cost))}</p>
              <p className="text-xs text-muted-foreground">Costo Estimado Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{supplierGroups.size}</p>
              <p className="text-xs text-muted-foreground">Proveedores</p>
            </CardContent>
          </Card>
        </div>

        {/* Items grouped by supplier */}
        <div className="space-y-4">
          {Array.from(supplierGroups.entries()).map(([suppId, items]) => {
            const supplierName = items[0]?.supplier?.name || 'Proveedor';
            const groupTotal = items.reduce((sum, item) => {
              const qty = item.override_quantity ?? item.suggested_quantity;
              return sum + qty * Number(item.estimated_cost);
            }, 0);

            return (
              <Card key={suppId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      {supplierName}
                      <Badge variant="outline" className="text-[10px] ml-1">{items.length} ítems</Badge>
                    </CardTitle>
                    <span className="text-sm font-semibold">{formatCurrency(groupTotal)}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ItemsTable
                    items={items}
                    editable={isDraft || isLocked}
                    onUpdateQty={handleUpdateItem}
                    onRemove={isDraft ? handleRemoveItem : undefined}
                  />
                </CardContent>
              </Card>
            );
          })}

          {noSupplierItems.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  Sin Proveedor Asignado
                  <Badge variant="outline" className="text-[10px] ml-1 border-amber-500/30 text-amber-500">
                    {noSupplierItems.length} ítems
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  Estos productos no tienen proveedor por defecto. No se generarán órdenes de compra para ellos.
                </p>
                <ItemsTable
                  items={noSupplierItems}
                  editable={isDraft || isLocked}
                  onUpdateQty={handleUpdateItem}
                  onRemove={isDraft ? handleRemoveItem : undefined}
                />
              </CardContent>
            </Card>
          )}

          {(selectedReq.items?.length || 0) === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Requisición vacía</h3>
                <p className="text-sm text-muted-foreground">
                  No hay productos en esta requisición. Genera desde inventario o agrega manualmente.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Approval result dialog */}
        <Dialog open={!!approvalResult} onOpenChange={() => setApprovalResult(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
                Requisición Aprobada
              </DialogTitle>
              <DialogDescription>
                Se generaron las siguientes órdenes de compra:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {approvalResult?.purchase_orders.map((po: any) => (
                <div key={po.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{po.folio || `OC-${String(po.folio_number || '').padStart(4, '0')}`}</p>
                    <p className="text-xs text-muted-foreground">Proveedor ID: {po.supplier_id?.slice(0, 8)}</p>
                  </div>
                  <Badge variant="outline">{formatCurrency(Number(po.total_cost))}</Badge>
                </div>
              ))}
              {(!approvalResult?.purchase_orders || approvalResult.purchase_orders.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No se generaron órdenes (todos los ítems estaban sin proveedor).
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setApprovalResult(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Render: List view ────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Requisiciones de Compra</h2>
          <p className="text-muted-foreground">
            Gestiona las necesidades de inventario y genera órdenes de compra automáticamente.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating || isGeneralSelected} className="gap-1.5">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Escanear Inventario
        </Button>
      </div>

      {isGeneralSelected && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-200">
            Selecciona una sucursal específica para ver y gestionar requisiciones. Las requisiciones se manejan por sucursal.
          </p>
        </div>
      )}

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Borradores', value: kpis.drafts, color: 'text-amber-500' },
            { label: 'En Revisión', value: kpis.locked, color: 'text-blue-500' },
            { label: 'Aprobadas', value: kpis.approved, color: 'text-emerald-500' },
            { label: 'Bajo Mínimo', value: kpis.below_minimum, color: 'text-red-500' },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Requisition list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : requisitions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin requisiciones</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {isGeneralSelected
                ? 'Selecciona una sucursal para ver las requisiciones.'
                : 'Haz clic en "Escanear Inventario" para detectar productos bajo mínimo y crear una requisición automáticamente.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requisitions.map((req) => {
            const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.draft;
            return (
              <Card
                key={req.id}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => openDetail(req.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">
                            REQ-{String(req.folio_number).padStart(4, '0')}
                          </h4>
                          <Badge className={`gap-1 text-[10px] ${statusCfg.color} border`}>
                            {statusCfg.icon}
                            {statusCfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {req.branch?.name || 'Sucursal'} ·{' '}
                          {req.item_count ?? req.total_items} productos ·{' '}
                          {formatDate(req.updated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(Number(req.total_estimated_cost))}</p>
                      <p className="text-[10px] text-muted-foreground">Costo estimado</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Items Table Component ──────────────────────────────────────

function ItemsTable({
  items,
  editable,
  onUpdateQty,
  onRemove,
}: {
  items: RequisitionItem[];
  editable: boolean;
  onUpdateQty: (itemId: string, qty: number | null) => void;
  onRemove?: (itemId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 w-[35%]">Producto</th>
            <th className="text-center px-2 py-2">Stock Actual</th>
            <th className="text-center px-2 py-2">Máximo</th>
            <th className="text-center px-2 py-2">Sugerido</th>
            <th className="text-center px-2 py-2">Cantidad</th>
            <th className="text-right px-2 py-2">Costo Unit.</th>
            <th className="text-right px-3 py-2">Subtotal</th>
            {onRemove && <th className="w-10"></th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => {
            const qty = item.override_quantity ?? item.suggested_quantity;
            const isOverridden = item.override_quantity !== null && item.override_quantity !== undefined;

            return (
              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {productImage(item) ? (
                      <img src={productImage(item)!} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-xs truncate">{item.variant?.product?.name || '-'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{variantLabel(item)} · {item.variant?.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center px-2 py-2">
                  <span className={`text-xs font-mono ${item.current_stock <= 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {item.current_stock}
                  </span>
                </td>
                <td className="text-center px-2 py-2">
                  <span className="text-xs font-mono text-muted-foreground">{item.max_stock}</span>
                </td>
                <td className="text-center px-2 py-2">
                  <span className="text-xs font-mono text-muted-foreground">{item.suggested_quantity}</span>
                </td>
                <td className="text-center px-2 py-2">
                  {editable ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        className="h-6 w-6 rounded border border-border hover:bg-muted flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); onUpdateQty(item.id, Math.max(1, qty - 1)); }}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 0) onUpdateQty(item.id, v);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-12 text-center text-xs font-mono rounded border px-1 py-1 bg-transparent ${
                          isOverridden ? 'border-primary text-primary font-bold' : 'border-border'
                        }`}
                      />
                      <button
                        className="h-6 w-6 rounded border border-border hover:bg-muted flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); onUpdateQty(item.id, qty + 1); }}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs font-mono ${isOverridden ? 'text-primary font-bold' : ''}`}>
                      {qty}
                    </span>
                  )}
                </td>
                <td className="text-right px-2 py-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatCurrency(Number(item.estimated_cost))}
                  </span>
                </td>
                <td className="text-right px-3 py-2">
                  <span className="text-xs font-mono font-medium">
                    {formatCurrency(qty * Number(item.estimated_cost))}
                  </span>
                </td>
                {onRemove && (
                  <td className="px-2 py-2">
                    <button
                      className="h-6 w-6 rounded hover:bg-red-500/10 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
                      onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
