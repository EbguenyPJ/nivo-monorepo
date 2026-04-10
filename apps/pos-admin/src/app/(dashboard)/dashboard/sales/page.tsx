'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Input,
} from '@nivo/ui';
import {
  Search, Receipt, ChevronLeft, ChevronRight, Eye, Printer, RotateCcw,
  Package, AlertTriangle, DollarSign, CreditCard, CheckCircle2,
  ArrowLeft, Minus, Plus, PackageX, Store, ShoppingBag,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getTodayRange, getThisWeekRange, getThisMonthRange, formatCurrency, formatDate } from '@/lib/date-utils';

// ─── Types ───────────────────────────────────────────────────────

interface SaleRow {
  id: string;
  folio: string;
  status: string;
  total_amount: number;
  discount_amount: number;
  payment_method: string;
  created_at: string;
  employee_name: string;
  branch_name: string;
  customer_name: string | null;
}

interface SaleDetailItem {
  id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  product_name: string;
  sku: string;
  attributes: Record<string, string>;
  image_url: string | null;
  returned_quantity: number;
  returnable_quantity: number;
}

interface SaleDetailPayment {
  id: string;
  payment_method_name: string;
  amount: number;
  reference: string | null;
}

interface SaleReturnRecord {
  id: string;
  refund_amount: number;
  refund_method: string;
  reason: string | null;
  employee_name: string;
  created_at: string;
  items: {
    id: string;
    variant_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    disposition: string;
  }[];
}

interface SaleDetail {
  id: string;
  folio: string;
  status: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  payment_method: string;
  sale_type: string;
  notes: string | null;
  created_at: string;
  employee_name: string;
  branch_name: string;
  branch_id: string;
  customer_name: string | null;
  items: SaleDetailItem[];
  payments: SaleDetailPayment[];
  returns: SaleReturnRecord[];
}

// Return flow types
interface ReturnItemSelection {
  sale_item_id: string;
  variant_id: string;
  quantity: number;
  max_returnable: number;
  unit_price: number;
  product_name: string;
  sku: string;
  image_url: string | null;
  disposition: 'floor' | 'shrinkage';
}

// ─── Constants ───────────────────────────────────────────────────

const PAGE_SIZE = 15;

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  partial_return: 'Dev. Parcial',
  refunded: 'Devuelta',
  pending: 'Pendiente',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  partial_return: 'outline',
  refunded: 'destructive',
  pending: 'secondary',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  mixed: 'Mixto',
  online: 'Online',
};

const REFUND_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card_reversal: 'Reversión Tarjeta',
  store_credit: 'Crédito en Tienda',
};

const DISPOSITION_LABELS: Record<string, string> = {
  floor: 'Piso de ventas',
  shrinkage: 'Merma',
};

function getDateRange(period: string): { start_date?: string; end_date?: string } {
  switch (period) {
    case 'today': return getTodayRange();
    case 'week': return getThisWeekRange();
    case 'month': return getThisMonthRange();
    default: return {};
  }
}

// ─── Main Page ───────────────────────────────────────────────────

export default function SalesHistoryPage() {
  const { selectedBranchId, isGeneralSelected } = useBranchStore();

  // Search & filters
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('month');
  const [statusFilter, setStatusFilter] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);

  // Data
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Drill-down
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Return flow
  const [returnStep, setReturnStep] = useState(0); // 0 = closed, 1 = select items, 2 = disposition, 3 = refund method
  const [returnItems, setReturnItems] = useState<ReturnItemSelection[]>([]);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card_reversal' | 'store_credit'>('cash');
  const [returnReason, setReturnReason] = useState('');
  const [returnProcessing, setReturnProcessing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ─── Fetch Sales ───────────────────────────────────────────────

  const fetchSales = useCallback(async (currentPage = 0) => {
    setLoading(true);
    try {
      const range = getDateRange(period);
      const params: Record<string, string> = {};
      if (range.start_date) params.start_date = range.start_date;
      if (range.end_date) params.end_date = range.end_date;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      if (!isGeneralSelected && selectedBranchId) params.branch_id = selectedBranchId;
      params.limit = String(PAGE_SIZE);
      params.offset = String(currentPage * PAGE_SIZE);

      const res = await apiClient.get('/pos/sales/history', { params });
      setSales(res.data.data || []);
      setTotalCount(res.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch sales:', error);
    } finally {
      setLoading(false);
    }
  }, [period, statusFilter, search, selectedBranchId, isGeneralSelected]);

  useEffect(() => {
    setPage(0);
    fetchSales(0);
  }, [fetchSales]);

  useEffect(() => {
    if (page > 0) fetchSales(page);
  }, [page]);

  // Debounced search
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setPage(0);
      // fetchSales will be triggered by the search dependency
    }, 400);
    setSearchTimer(timer);
  };

  // ─── Drill-down ────────────────────────────────────────────────

  const openDetail = async (saleId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setReturnStep(0);
    try {
      const res = await apiClient.get('/pos/sales/detail', { params: { sale_id: saleId } });
      setDetail(res.data);
    } catch (error) {
      console.error('Failed to fetch sale detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Print Receipt ─────────────────────────────────────────────

  const printReceipt = () => {
    if (!detail) return;
    const html = generateReceiptHTML(detail);
    const win = window.open('', '_blank', 'width=350,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  // ─── Return Flow ───────────────────────────────────────────────

  const startReturn = () => {
    if (!detail) return;
    const items: ReturnItemSelection[] = detail.items
      .filter((item) => item.returnable_quantity > 0)
      .map((item) => ({
        sale_item_id: item.id,
        variant_id: item.variant_id,
        quantity: 0,
        max_returnable: item.returnable_quantity,
        unit_price: item.unit_price,
        product_name: item.product_name,
        sku: item.sku,
        image_url: item.image_url,
        disposition: 'floor' as const,
      }));
    setReturnItems(items);
    setRefundMethod(detail.payment_method === 'cash' ? 'cash' : 'card_reversal');
    setReturnReason('');
    setReturnStep(1);
  };

  const updateReturnItemQty = (idx: number, delta: number) => {
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const newQty = Math.max(0, Math.min(item.max_returnable, item.quantity + delta));
        return { ...item, quantity: newQty };
      }),
    );
  };

  const updateReturnItemDisposition = (idx: number, disposition: 'floor' | 'shrinkage') => {
    setReturnItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, disposition } : item)),
    );
  };

  const selectedReturnItems = returnItems.filter((i) => i.quantity > 0);
  const returnTotal = selectedReturnItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  const submitReturn = async () => {
    if (!detail || selectedReturnItems.length === 0) return;
    setReturnProcessing(true);
    try {
      await apiClient.post('/pos/returns', {
        sale_id: detail.id,
        employee_id: '', // Will be overridden by JWT user in backend
        branch_id: detail.branch_id,
        refund_method: refundMethod,
        reason: returnReason || null,
        items: selectedReturnItems.map((i) => ({
          sale_item_id: i.sale_item_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          disposition: i.disposition,
        })),
      });

      // Refresh detail and list
      setReturnStep(0);
      const res = await apiClient.get('/pos/sales/detail', { params: { sale_id: detail.id } });
      setDetail(res.data);
      fetchSales(page);
    } catch (error: any) {
      console.error('Return failed:', error);
      alert(error.response?.data?.message || 'Error al procesar la devolución');
    } finally {
      setReturnProcessing(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Historial de Tickets</h2>
          <p className="text-muted-foreground">Busca, reimprime y gestiona devoluciones</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder="Buscar por folio del ticket o escanear código de barras..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
          className="pl-12 h-14 text-lg"
          autoFocus
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
            <SelectItem value="partial_return">Dev. Parcial</SelectItem>
            <SelectItem value="refunded">Devuelta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tickets</CardTitle>
            {!loading && totalCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">
                {search ? 'No se encontraron tickets con ese folio.' : 'No hay tickets en el periodo seleccionado.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-muted-foreground">Folio</th>
                      <th className="pb-3 font-medium text-muted-foreground">Fecha</th>
                      {isGeneralSelected && (
                        <th className="pb-3 font-medium text-muted-foreground">Sucursal</th>
                      )}
                      <th className="pb-3 font-medium text-muted-foreground">Cliente</th>
                      <th className="pb-3 font-medium text-muted-foreground">Cajero</th>
                      <th className="pb-3 font-medium text-muted-foreground">Pago</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">Total</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">Estado</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => openDetail(sale.id)}
                      >
                        <td className="py-3 font-mono font-bold text-xs">{sale.folio}</td>
                        <td className="py-3 text-muted-foreground">{formatDate(sale.created_at)}</td>
                        {isGeneralSelected && (
                          <td className="py-3">{sale.branch_name}</td>
                        )}
                        <td className="py-3">{sale.customer_name || '—'}</td>
                        <td className="py-3">{sale.employee_name}</td>
                        <td className="py-3">
                          <Badge variant="outline">{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</Badge>
                        </td>
                        <td className="py-3 text-right font-medium tabular-nums">
                          {formatCurrency(sale.total_amount)}
                        </td>
                        <td className="py-3 text-right">
                          <SaleStatusBadge status={sale.status} />
                        </td>
                        <td className="py-3 text-right">
                          <Button variant="ghost" size="sm" className="gap-1 h-8">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <Button
                    variant="outline" size="sm" className="gap-1"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                      let pageNum: number;
                      if (totalPages <= 7) pageNum = i;
                      else if (page < 3) pageNum = i;
                      else if (page > totalPages - 4) pageNum = totalPages - 7 + i;
                      else pageNum = page - 3 + i;
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? 'default' : 'outline'}
                          size="sm" className="w-9 h-9 p-0"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum + 1}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline" size="sm" className="gap-1"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Detail / Return Dialog ─────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) { setDetailOpen(false); setReturnStep(0); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="space-y-4 py-8">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : detail ? (
            returnStep === 0 ? (
              <SaleDetailView
                detail={detail}
                onPrint={printReceipt}
                onStartReturn={startReturn}
              />
            ) : (
              <ReturnFlow
                detail={detail}
                step={returnStep}
                setStep={setReturnStep}
                items={returnItems}
                selectedItems={selectedReturnItems}
                returnTotal={returnTotal}
                refundMethod={refundMethod}
                setRefundMethod={setRefundMethod}
                returnReason={returnReason}
                setReturnReason={setReturnReason}
                updateQty={updateReturnItemQty}
                updateDisposition={updateReturnItemDisposition}
                processing={returnProcessing}
                onSubmit={submitReturn}
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Error al cargar el ticket.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function SaleStatusBadge({ status }: { status: string }) {
  const isReturn = status === 'partial_return' || status === 'refunded';
  return (
    <Badge variant={STATUS_VARIANTS[status] || 'outline'} className={isReturn ? 'border-orange-500/30 text-orange-500 bg-orange-500/10' : ''}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

const THUMB_SIZES = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
} as const;

function ItemThumbnail({
  imageUrl, name, size = 'md',
}: {
  imageUrl: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = THUMB_SIZES[size];

  if (!imageUrl) {
    return (
      <div className={`${sizeClass} rounded-lg bg-muted flex items-center justify-center flex-shrink-0`}>
        <ShoppingBag className={`${size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} text-muted-foreground`} />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className={`${sizeClass} rounded-lg object-cover flex-shrink-0 bg-muted`}
      onError={(e) => {
        // Replace with fallback on load error
        const el = e.target as HTMLImageElement;
        el.style.display = 'none';
        const fallback = document.createElement('div');
        fallback.className = `${sizeClass} rounded-lg bg-muted flex items-center justify-center flex-shrink-0`;
        fallback.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
        el.parentNode?.insertBefore(fallback, el);
      }}
    />
  );
}

// ─── Sale Detail View ────────────────────────────────────────────

function SaleDetailView({
  detail, onPrint, onStartReturn,
}: {
  detail: SaleDetail;
  onPrint: () => void;
  onStartReturn: () => void;
}) {
  const hasReturnableItems = detail.items.some((i) => i.returnable_quantity > 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Ticket #{detail.folio}
        </DialogTitle>
        <DialogDescription>
          {formatDate(detail.created_at)} — {detail.branch_name}
        </DialogDescription>
      </DialogHeader>

      {/* Actions */}
      <div className="flex items-center gap-2 pb-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onPrint}>
          <Printer className="h-4 w-4" />
          Reimprimir
        </Button>
        {hasReturnableItems && detail.status !== 'refunded' && (
          <Button variant="destructive" size="sm" className="gap-1.5 ml-auto" onClick={onStartReturn}>
            <RotateCcw className="h-4 w-4" />
            Ejecutar Devolución
          </Button>
        )}
      </div>

      {/* Sale Info */}
      <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3">
        <div>
          <p className="text-muted-foreground text-xs">Estado</p>
          <SaleStatusBadge status={detail.status} />
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Cajero</p>
          <p className="font-medium">{detail.employee_name}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Cliente</p>
          <p className="font-medium">{detail.customer_name || 'Público general'}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Forma de pago</p>
          <p className="font-medium">{PAYMENT_LABELS[detail.payment_method] || detail.payment_method}</p>
        </div>
      </div>

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
            const variantLabel = [attrs?.color, attrs?.size_mex || attrs?.size].filter(Boolean).join(' / ');
            return (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                <ItemThumbnail imageUrl={item.image_url} name={item.product_name} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {variantLabel && <span>{variantLabel} · </span>}
                    SKU: {item.sku}
                    {item.returned_quantity > 0 && (
                      <span className="text-orange-500 ml-2">({item.returned_quantity} devueltos)</span>
                    )}
                  </p>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <p className="tabular-nums">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                  <p className="font-medium tabular-nums">{formatCurrency(item.subtotal)}</p>
                </div>
              </div>
            );
          })}
          {/* Totals */}
          <div className="pt-2 space-y-1">
            {detail.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Descuento</span>
                <span className="tabular-nums">-{formatCurrency(detail.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(detail.total_amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CreditCard className="h-4 w-4" />
            Pagos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {detail.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1">
              <div>
                <span className="font-medium">{p.payment_method_name}</span>
                {p.reference && <span className="text-muted-foreground text-xs ml-2">Ref: {p.reference}</span>}
              </div>
              <span className="font-medium tabular-nums">{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Returns History */}
      {detail.returns.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5 text-orange-500">
              <RotateCcw className="h-4 w-4" />
              Devoluciones ({detail.returns.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.returns.map((ret) => (
              <div key={ret.id} className="border rounded-lg p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{formatDate(ret.created_at)}</p>
                    <p className="text-xs">Procesó: {ret.employee_name}</p>
                    {ret.reason && <p className="text-xs text-muted-foreground italic">"{ret.reason}"</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-500 tabular-nums">-{formatCurrency(ret.refund_amount)}</p>
                    <Badge variant="outline" className="text-xs">{REFUND_METHOD_LABELS[ret.refund_method] || ret.refund_method}</Badge>
                  </div>
                </div>
                {ret.items.map((ri) => (
                  <div key={ri.id} className="flex items-center justify-between text-xs text-muted-foreground pl-2 border-l-2">
                    <span>{ri.quantity}x — {DISPOSITION_LABELS[ri.disposition] || ri.disposition}</span>
                    <span className="tabular-nums">{formatCurrency(ri.subtotal)}</span>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ─── Return Flow ─────────────────────────────────────────────────

function ReturnFlow({
  detail, step, setStep, items, selectedItems, returnTotal,
  refundMethod, setRefundMethod, returnReason, setReturnReason,
  updateQty, updateDisposition, processing, onSubmit,
}: {
  detail: SaleDetail;
  step: number;
  setStep: (s: number) => void;
  items: ReturnItemSelection[];
  selectedItems: ReturnItemSelection[];
  returnTotal: number;
  refundMethod: 'cash' | 'card_reversal' | 'store_credit';
  setRefundMethod: (m: 'cash' | 'card_reversal' | 'store_credit') => void;
  returnReason: string;
  setReturnReason: (r: string) => void;
  updateQty: (idx: number, delta: number) => void;
  updateDisposition: (idx: number, d: 'floor' | 'shrinkage') => void;
  processing: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-red-500" />
          Devolución — Ticket #{detail.folio}
        </DialogTitle>
        <DialogDescription>
          {step === 1 && 'Paso 1 de 3 — Selecciona los artículos a devolver'}
          {step === 2 && 'Paso 2 de 3 — Define el destino de cada artículo'}
          {step === 3 && 'Paso 3 de 3 — Método de reembolso'}
        </DialogDescription>
      </DialogHeader>

      {/* Step indicator */}
      <div className="flex items-center gap-2 pb-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-red-500' : 'bg-muted'}`}
          />
        ))}
      </div>

      {/* Step 1: Select items */}
      {step === 1 && (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.sale_item_id} className="flex items-center gap-3 border rounded-lg p-3">
              <ItemThumbnail imageUrl={item.image_url} name={item.product_name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  SKU: {item.sku} · Máx: {item.max_returnable}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <Button
                  variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={item.quantity <= 0}
                  onClick={() => updateQty(idx, -1)}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center font-bold tabular-nums">{item.quantity}</span>
                <Button
                  variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={item.quantity >= item.max_returnable}
                  onClick={() => updateQty(idx, 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {selectedItems.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t font-semibold text-sm">
              <span>Reembolso estimado</span>
              <span className="tabular-nums text-red-500">{formatCurrency(returnTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Disposition */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Por cada artículo, indica si regresa al piso de ventas o va a merma.
          </p>
          {items.filter((i) => i.quantity > 0).map((item) => {
            const idx = items.indexOf(item);
            return (
              <div key={item.sale_item_id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <ItemThumbnail imageUrl={item.image_url} name={item.product_name} size="md" />
                  <p className="font-medium text-sm">{item.product_name} × {item.quantity}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={item.disposition === 'floor' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5 h-10"
                    onClick={() => updateDisposition(idx, 'floor')}
                  >
                    <Store className="h-4 w-4" />
                    Piso de Ventas
                  </Button>
                  <Button
                    variant={item.disposition === 'shrinkage' ? 'destructive' : 'outline'}
                    size="sm"
                    className="gap-1.5 h-10"
                    onClick={() => updateDisposition(idx, 'shrinkage')}
                  >
                    <PackageX className="h-4 w-4" />
                    Merma
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.disposition === 'floor'
                    ? 'El artículo regresará al inventario de la sucursal.'
                    : 'El artículo NO regresará al inventario. Se registrará como merma.'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Step 3: Refund method */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Refund method selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Método de reembolso</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={refundMethod === 'cash' ? 'default' : 'outline'}
                className="gap-1.5 h-12"
                onClick={() => setRefundMethod('cash')}
              >
                <DollarSign className="h-4 w-4" />
                Efectivo
              </Button>
              <Button
                variant={refundMethod === 'card_reversal' ? 'default' : 'outline'}
                className="gap-1.5 h-12"
                onClick={() => setRefundMethod('card_reversal')}
              >
                <CreditCard className="h-4 w-4" />
                Reversión Tarjeta
              </Button>
            </div>
          </div>

          {/* Card reversal warning */}
          {refundMethod === 'card_reversal' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-yellow-600 dark:text-yellow-400">
                Recuerda procesar la devolución directamente en tu Terminal Bancaria física.
                El sistema solo registrará la transacción contablemente.
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Motivo (opcional)</p>
            <Input
              placeholder="Ej: Cliente se equivocó de talla"
              value={returnReason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReturnReason(e.target.value)}
            />
          </div>

          {/* Summary */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-2 text-sm">
              <p className="font-semibold">Resumen de devolución</p>
              {selectedItems.map((item) => (
                <div key={item.sale_item_id} className="flex items-center gap-2 text-muted-foreground">
                  <ItemThumbnail imageUrl={item.image_url} name={item.product_name} size="sm" />
                  <span className="flex-1 truncate">{item.quantity}× {item.product_name}</span>
                  <span className="tabular-nums flex-shrink-0">{formatCurrency(item.quantity * item.unit_price)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold text-red-500">
                <span>Total a reembolsar</span>
                <span className="tabular-nums">{formatCurrency(returnTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Vía: {REFUND_METHOD_LABELS[refundMethod]}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation buttons */}
      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          variant="outline"
          onClick={() => step === 1 ? setStep(0) : setStep(step - 1)}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? 'Cancelar' : 'Atrás'}
        </Button>
        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && selectedItems.length === 0}
            className="gap-1.5"
          >
            Siguiente
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={processing}
            className="gap-1.5"
          >
            {processing ? (
              'Procesando...'
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar Devolución
              </>
            )}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

// ─── Receipt HTML (reprint) ──────────────────────────────────────

function generateReceiptHTML(detail: SaleDetail): string {
  const now = new Date(detail.created_at);
  const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  const subtotal = detail.total_amount / 1.16;
  const iva = detail.total_amount - subtotal;

  let itemsHTML = '';
  for (const item of detail.items) {
    const attrs = item.attributes;
    const variantLabel = [attrs?.color, attrs?.size_mex || attrs?.size].filter(Boolean).join(' / ');
    itemsHTML += `
      <div style="margin-bottom:4px">
        <div style="font-weight:bold">${item.product_name}</div>
        ${variantLabel ? `<div style="font-size:10px;color:#666">${variantLabel} · ${item.sku}</div>` : ''}
        <div style="display:flex;justify-content:space-between">
          <span>${item.quantity} x $${item.unit_price.toFixed(2)}</span>
          <span>$${item.subtotal.toFixed(2)}</span>
        </div>
      </div>`;
  }

  let paymentsHTML = '';
  for (const p of detail.payments) {
    paymentsHTML += `
      <div style="display:flex;justify-content:space-between">
        <span>${p.payment_method_name}</span>
        <span>$${p.amount.toFixed(2)}</span>
      </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Ticket ${detail.folio}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 4mm auto; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; }
</style></head><body>
  <div class="center bold" style="font-size:14px">${detail.branch_name}</div>
  <div class="center" style="font-size:10px">${dateStr} ${timeStr}</div>
  <div class="center" style="font-size:10px">Folio: ${detail.folio}</div>
  <div class="center" style="font-size:10px">Atendió: ${detail.employee_name}</div>
  <div class="divider"></div>
  ${itemsHTML}
  <div class="divider"></div>
  <div class="row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
  <div class="row"><span>IVA 16%</span><span>$${iva.toFixed(2)}</span></div>
  <div class="row bold" style="font-size:14px"><span>TOTAL</span><span>$${detail.total_amount.toFixed(2)}</span></div>
  <div class="divider"></div>
  ${paymentsHTML}
  <div class="divider"></div>
  <div class="center" style="font-size:10px;margin-top:8px">--- REIMPRESIÓN ---</div>
  <div class="center" style="font-size:10px;margin-top:4px">Gracias por tu compra!</div>
</body></html>`;
}
