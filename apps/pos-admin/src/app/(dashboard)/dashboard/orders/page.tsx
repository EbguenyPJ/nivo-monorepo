'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Input, Tabs, TabsList, TabsTrigger, TabsContent,
} from '@nivo/ui';
import {
  Search, ShoppingCart, ChevronLeft, ChevronRight, Eye, Package,
  Clock, CheckCircle2, XCircle, Truck, MapPin, Store, AlertTriangle,
  QrCode, PenLine, HandMetal, Navigation, Camera, User,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '@/lib/api';
import LazyTrackingMap from '@/components/LazyTrackingMap';
import { getTodayRange, getThisWeekRange, getThisMonthRange, formatCurrency, formatDate } from '@/lib/date-utils';

// ─── Types ───────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  is_picked: boolean;
  variant: {
    sku: string;
    product: { name: string; image_url: string | null };
  };
}

interface Order {
  id: string;
  order_number: number;
  customer_id: string;
  customer: { id: string; name: string; email: string; phone: string };
  fulfillment_type: 'bopis' | 'delivery' | 'ship_to_home';
  status: string;
  total_amount: number;
  discount_amount: number;
  tax_amount: number;
  shipping_cost: number;
  shipping_address: Record<string, string> | null;
  pickup_branch_id: string | null;
  pickup_branch: { id: string; name: string } | null;
  pickup_location: string | null;
  signature_url: string | null;
  notes: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  packed_at: string | null;
  completed_at: string | null;
}

// ─── Constants ───────────────────────────────────────────────────

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pendiente de Pago',
  paid: 'Pagado',
  picking: 'Surtiendo',
  packed: 'Empacado',
  ready_for_pickup: 'Listo para Recoger',
  picked_up: 'Recogido',
  out_for_delivery: 'En Reparto',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  paid: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  picking: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  packed: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
  ready_for_pickup: 'bg-green-500/15 text-green-500 border-green-500/30',
  picked_up: 'bg-zinc-400/15 text-zinc-400 border-zinc-400/30',
  out_for_delivery: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30',
  delivered: 'bg-green-500/15 text-green-500 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-500 border-red-500/30',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  bopis: 'Recoger en Tienda',
  delivery: 'Envío',
  ship_to_home: 'Envío a Domicilio',
};

const FULFILLMENT_ICONS: Record<string, typeof Store> = {
  bopis: Store,
  delivery: Truck,
  ship_to_home: MapPin,
};

interface DeliveryProofData {
  id: string;
  order_id: string;
  employee_id: string;
  employee?: { name: string };
  latitude: number;
  longitude: number;
  photo_url: string | null;
  recipient_name: string | null;
  notes: string | null;
  status: string;
  delivered_at: string;
}

// All statuses in order for the timeline
const STATUS_FLOW: string[] = [
  'pending_payment',
  'paid',
  'picking',
  'packed',
  'ready_for_pickup',
  'picked_up',
  'out_for_delivery',
  'delivered',
];

// Delivery flow (no pickup steps)
const DELIVERY_FLOW: string[] = [
  'pending_payment',
  'paid',
  'picking',
  'packed',
  'out_for_delivery',
  'delivered',
];

// BOPIS flow (no delivery steps)
const BOPIS_FLOW: string[] = [
  'pending_payment',
  'paid',
  'picking',
  'packed',
  'ready_for_pickup',
  'picked_up',
];

// Completed/terminal statuses
const COMPLETED_STATUSES = ['picked_up', 'delivered'];
const IN_PROGRESS_STATUSES = ['paid', 'picking', 'packed', 'ready_for_pickup', 'out_for_delivery'];

// Fulfillment tab definitions
type FulfillmentTab = 'all' | 'bopis' | 'delivery';

function getDateRange(period: string): { start_date?: string; end_date?: string } {
  switch (period) {
    case 'today': return getTodayRange();
    case 'week': return getThisWeekRange();
    case 'month': return getThisMonthRange();
    default: return {};
  }
}

function getFolio(orderNumber: number): string {
  return `ORD-${String(orderNumber).padStart(5, '0')}`;
}

function getFlowForOrder(fulfillmentType: string): string[] {
  if (fulfillmentType === 'bopis') return BOPIS_FLOW;
  return DELIVERY_FLOW;
}

// ─── Main Page ───────────────────────────────────────────────────

export default function OrdersPage() {
  // Filters
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('month');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [fulfillmentTab, setFulfillmentTab] = useState<FulfillmentTab>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  // Data
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // QR dialog
  const [qrOpen, setQrOpen] = useState(false);
  const [qrOrder, setQrOrder] = useState<Order | null>(null);

  // Debounced search
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);

  // Compute the effective fulfillment_type filter: tab takes priority over dropdown
  const effectiveFulfillmentFilter = fulfillmentTab !== 'all' ? fulfillmentTab : fulfillmentFilter;

  // ─── Fetch Orders ─────────────────────────────────────────────

  const fetchOrders = useCallback(async (currentPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const range = getDateRange(period);
      const params: Record<string, string> = {};
      if (range.start_date) params.start_date = range.start_date;
      if (range.end_date) params.end_date = range.end_date;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (effectiveFulfillmentFilter !== 'all') params.fulfillment_type = effectiveFulfillmentFilter;
      if (search.trim()) params.search = search.trim();
      params.page = String(currentPage);
      params.limit = String(PAGE_SIZE);

      const res = await apiClient.get('/orders', { params });
      setOrders(res.data.items || []);
      setTotalCount(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError('Error al cargar los pedidos. Intenta de nuevo.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [period, statusFilter, effectiveFulfillmentFilter, search]);

  useEffect(() => {
    setPage(1);
    fetchOrders(1);
  }, [fetchOrders]);

  useEffect(() => {
    if (page > 1) fetchOrders(page);
  }, [page]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setPage(1);
    }, 400);
    setSearchTimer(timer);
  };

  // When changing fulfillment tab, reset the dropdown filter to avoid conflicts
  const handleFulfillmentTabChange = (tab: string) => {
    setFulfillmentTab(tab as FulfillmentTab);
    setFulfillmentFilter('all');
    setPage(1);
  };

  // ─── Detail ────────────────────────────────────────────────────

  const openDetail = async (orderId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiClient.get(`/orders/${orderId}`);
      setDetail(res.data);
    } catch (err) {
      console.error('Failed to fetch order detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Status Actions ────────────────────────────────────────────

  const updateStatus = async (orderId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      await apiClient.put(`/orders/${orderId}/status`, { status: newStatus });
      // Refresh detail
      const res = await apiClient.get(`/orders/${orderId}`);
      setDetail(res.data);
      // Refresh list
      fetchOrders(page);
    } catch (err: any) {
      console.error('Failed to update order status:', err);
      alert(err.response?.data?.message || 'Error al actualizar el estado del pedido');
    } finally {
      setActionLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('¿Estás seguro de cancelar este pedido?')) return;
    setActionLoading(true);
    try {
      await apiClient.put(`/orders/${orderId}/cancel`);
      const res = await apiClient.get(`/orders/${orderId}`);
      setDetail(res.data);
      fetchOrders(page);
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      alert(err.response?.data?.message || 'Error al cancelar el pedido');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Stats ─────────────────────────────────────────────────────

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending_payment').length,
    inProgress: orders.filter((o) => IN_PROGRESS_STATUSES.includes(o.status)).length,
    completed: orders.filter((o) => COMPLETED_STATUSES.includes(o.status)).length,
    readyForPickup: orders.filter((o) => o.status === 'ready_for_pickup' && o.fulfillment_type === 'bopis').length,
  };

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Pedidos Online</h2>
            <p className="text-muted-foreground">Gestiona los pedidos de tu tienda en línea</p>
          </div>
        </div>
      </div>

      {/* Fulfillment Tabs */}
      <Tabs value={fulfillmentTab} onValueChange={handleFulfillmentTabChange}>
        <TabsList className="bg-zinc-800/50 border border-zinc-700">
          <TabsTrigger value="all" className="data-[state=active]:bg-zinc-700 gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            Todos
          </TabsTrigger>
          <TabsTrigger value="bopis" className="data-[state=active]:bg-zinc-700 gap-1.5">
            <Store className="h-3.5 w-3.5" />
            Click &amp; Collect
            {stats.readyForPickup > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                {stats.readyForPickup}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="delivery" className="data-[state=active]:bg-zinc-700 gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            Entregas
          </TabsTrigger>
        </TabsList>

        {/* Pickup-ready banner (only visible on Click & Collect tab) */}
        <TabsContent value="bopis" className="mt-0">
          {!loading && stats.readyForPickup > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 mt-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20 flex-shrink-0">
                <HandMetal className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-green-400">
                  {stats.readyForPickup} pedido{stats.readyForPickup !== 1 ? 's' : ''} listo{stats.readyForPickup !== 1 ? 's' : ''} para recoger
                </p>
                <p className="text-xs text-green-500/70">
                  Estos pedidos ya están empacados y esperando al cliente
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
            <SelectItem value="all">Todo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Only show fulfillment dropdown when on "Todos" tab */}
        {fulfillmentTab === 'all' && (
          <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tipo de entrega" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {Object.entries(FULFILLMENT_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Buscar por folio o cliente..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total pedidos</p>
                <p className="text-2xl font-bold">{loading ? '—' : stats.total}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-500">{loading ? '—' : stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En proceso</p>
                <p className="text-2xl font-bold text-blue-500">{loading ? '—' : stats.inProgress}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold text-green-500">{loading ? '—' : stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Pedidos</CardTitle>
            {!loading && totalCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
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
          ) : error ? (
            <div className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchOrders(page)}>
                Reintentar
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">
                {search ? 'No se encontraron pedidos con esa búsqueda.' : 'No hay pedidos en el periodo seleccionado.'}
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
                      <th className="pb-3 font-medium text-muted-foreground">Cliente</th>
                      <th className="pb-3 font-medium text-muted-foreground">Tipo</th>
                      <th className="pb-3 font-medium text-muted-foreground">Estado</th>
                      <th className="pb-3 font-medium text-muted-foreground text-center">Items</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">Total</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const FulfillIcon = FULFILLMENT_ICONS[order.fulfillment_type] || Package;
                      return (
                        <tr
                          key={order.id}
                          className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => openDetail(order.id)}
                        >
                          <td className="py-3 font-mono font-bold text-xs">{getFolio(order.order_number)}</td>
                          <td className="py-3 text-muted-foreground">{formatDate(order.created_at)}</td>
                          <td className="py-3">{order.customer?.name || '—'}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5">
                              <FulfillIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs">{FULFILLMENT_LABELS[order.fulfillment_type] || order.fulfillment_type}</span>
                            </div>
                          </td>
                          <td className="py-3">
                            <OrderStatusBadge
                              status={order.status}
                              pickupLocation={order.pickup_location}
                              signatureName={order.signature_url ? 'Cliente' : null}
                              fulfillmentType={order.fulfillment_type}
                            />
                          </td>
                          <td className="py-3 text-center tabular-nums">{order.items?.length || 0}</td>
                          <td className="py-3 text-right font-medium tabular-nums">
                            {formatCurrency(order.total_amount)}
                          </td>
                          <td className="py-3 text-right">
                            <Button variant="ghost" size="sm" className="gap-1 h-8">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <Button
                    variant="outline" size="sm" className="gap-1"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </p>
                  <Button
                    variant="outline" size="sm" className="gap-1"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

      {/* ─── Detail Dialog ──────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) setDetailOpen(false); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="space-y-4 py-8">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : detail ? (
            <OrderDetailView
              order={detail}
              onUpdateStatus={updateStatus}
              onCancel={cancelOrder}
              actionLoading={actionLoading}
              onShowQr={(order) => { setQrOrder(order); setQrOpen(true); }}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Error al cargar el pedido.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── QR Code Dialog ─────────────────────────────────────── */}
      <Dialog open={qrOpen} onOpenChange={(open) => { if (!open) setQrOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          {qrOrder && (
            <OrderQRDisplay order={qrOrder} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function OrderStatusBadge({
  status,
  pickupLocation,
  signatureName,
  fulfillmentType,
}: {
  status: string;
  pickupLocation?: string | null;
  signatureName?: string | null;
  fulfillmentType?: string;
}) {
  const colorClass = STATUS_COLORS[status] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30';

  // Enhanced badge for BOPIS pickup statuses
  if (status === 'ready_for_pickup' && fulfillmentType === 'bopis') {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="outline" className={`${colorClass} border text-xs gap-1`}>
          <Store className="h-3 w-3" />
          {STATUS_LABELS[status]}
        </Badge>
        {pickupLocation && (
          <span className="text-[10px] text-muted-foreground pl-0.5">{pickupLocation}</span>
        )}
      </div>
    );
  }

  if (status === 'picked_up' && fulfillmentType === 'bopis') {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="outline" className={`${colorClass} border text-xs gap-1`}>
          <CheckCircle2 className="h-3 w-3" />
          {STATUS_LABELS[status]}
        </Badge>
        {signatureName && (
          <span className="text-[10px] text-muted-foreground pl-0.5 flex items-center gap-0.5">
            <PenLine className="h-2.5 w-2.5" />
            {signatureName}
          </span>
        )}
      </div>
    );
  }

  return (
    <Badge variant="outline" className={`${colorClass} border text-xs`}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

// ─── QR Code Display ────────────────────────────────────────────

function OrderQRDisplay({ order }: { order: Order }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-5 w-5" />
          Código QR para el cliente
        </DialogTitle>
        <DialogDescription>
          Pedido #{getFolio(order.order_number)}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center gap-4 py-4">
        <div className="p-4 bg-white rounded-xl">
          <QRCodeSVG
            value={`nivo-order://${order.id}`}
            size={200}
            level="H"
            includeMargin={false}
          />
        </div>

        <div className="text-center space-y-1">
          <p className="font-mono text-sm font-bold tracking-wider">{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-xs text-muted-foreground">
            El cliente puede presentar este código al momento de recoger su pedido
          </p>
        </div>

        {order.pickup_branch && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-lg px-3 py-2 w-full">
            <Store className="h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Sucursal de recogida</p>
              <p className="font-medium text-foreground">{order.pickup_branch.name}</p>
            </div>
          </div>
        )}

        {order.pickup_location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-lg px-3 py-2 w-full">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Ubicación de recogida</p>
              <p className="font-medium text-foreground">{order.pickup_location}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Status Timeline ─────────────────────────────────────────────

function StatusTimeline({ order }: { order: Order }) {
  const flow = getFlowForOrder(order.fulfillment_type);
  const currentIndex = flow.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-1">
        {flow.map((step, idx) => {
          const isCompleted = !isCancelled && currentIndex >= idx;
          const isCurrent = !isCancelled && currentIndex === idx;
          return (
            <div key={step} className="flex flex-col items-center flex-1 min-w-0">
              <div className="flex items-center w-full">
                {idx > 0 && (
                  <div className={`h-0.5 flex-1 ${isCompleted ? 'bg-green-500' : 'bg-zinc-700'}`} />
                )}
                <div
                  className={`h-3 w-3 rounded-full flex-shrink-0 border-2 transition-colors ${
                    isCurrent
                      ? 'bg-green-500 border-green-400 ring-2 ring-green-500/30'
                      : isCompleted
                        ? 'bg-green-500 border-green-500'
                        : 'bg-zinc-800 border-zinc-600'
                  }`}
                />
                {idx < flow.length - 1 && (
                  <div className={`h-0.5 flex-1 ${!isCancelled && currentIndex > idx ? 'bg-green-500' : 'bg-zinc-700'}`} />
                )}
              </div>
              <p className={`text-[10px] mt-1.5 text-center leading-tight ${
                isCurrent ? 'text-green-500 font-semibold' : isCompleted ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                {STATUS_LABELS[step] || step}
              </p>
            </div>
          );
        })}
      </div>
      {isCancelled && (
        <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-400">Este pedido fue cancelado</p>
        </div>
      )}
    </div>
  );
}

// ─── Order Detail View ───────────────────────────────────────────

function OrderDetailView({
  order, onUpdateStatus, onCancel, actionLoading, onShowQr,
}: {
  order: Order;
  onUpdateStatus: (orderId: string, status: string) => void;
  onCancel: (orderId: string) => void;
  actionLoading: boolean;
  onShowQr: (order: Order) => void;
}) {
  const FulfillIcon = FULFILLMENT_ICONS[order.fulfillment_type] || Package;
  const isTerminal = COMPLETED_STATUSES.includes(order.status) || order.status === 'cancelled';

  // Tracking & delivery proof state
  const showTrackingMap = ['out_for_delivery', 'delivered'].includes(order.status)
    && order.fulfillment_type !== 'bopis';
  const [deliveryProof, setDeliveryProof] = useState<DeliveryProofData | null>(null);
  const [proofLoading, setProofLoading] = useState(false);

  useEffect(() => {
    if (order.status === 'delivered' && order.fulfillment_type !== 'bopis') {
      setProofLoading(true);
      apiClient.get(`/api/v1/mobile/delivery/${order.id}/proof`)
        .then((res) => setDeliveryProof(res.data))
        .catch(() => setDeliveryProof(null))
        .finally(() => setProofLoading(false));
    }
  }, [order.id, order.status, order.fulfillment_type]);

  // Determine next action based on current status and fulfillment type
  const getNextAction = (): { label: string; nextStatus: string } | null => {
    switch (order.status) {
      case 'paid':
        return { label: 'Iniciar Surtido', nextStatus: 'picking' };
      case 'picking':
        return { label: 'Marcar Empacado', nextStatus: 'packed' };
      case 'packed':
        if (order.fulfillment_type === 'bopis') {
          return { label: 'Listo para Recoger', nextStatus: 'ready_for_pickup' };
        }
        return { label: 'Enviar', nextStatus: 'out_for_delivery' };
      case 'ready_for_pickup':
        return { label: 'Marcar Recogido', nextStatus: 'picked_up' };
      case 'out_for_delivery':
        return { label: 'Marcar Entregado', nextStatus: 'delivered' };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Pedido #{getFolio(order.order_number)}
        </DialogTitle>
        <DialogDescription>
          {formatDate(order.created_at)}
        </DialogDescription>
      </DialogHeader>

      {/* Order Info */}
      <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3">
        <div>
          <p className="text-muted-foreground text-xs">Cliente</p>
          <p className="font-medium">{order.customer?.name || '—'}</p>
          {order.customer?.email && (
            <p className="text-xs text-muted-foreground">{order.customer.email}</p>
          )}
          {order.customer?.phone && (
            <p className="text-xs text-muted-foreground">{order.customer.phone}</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Tipo de entrega</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <FulfillIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{FULFILLMENT_LABELS[order.fulfillment_type] || order.fulfillment_type}</span>
          </div>
          {order.pickup_branch && (
            <p className="text-xs text-muted-foreground mt-0.5">Sucursal: {order.pickup_branch.name}</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Estado</p>
          <div className="mt-0.5">
            <OrderStatusBadge
              status={order.status}
              pickupLocation={order.pickup_location}
              signatureName={order.signature_url ? 'Cliente' : null}
              fulfillmentType={order.fulfillment_type}
            />
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Fecha de pago</p>
          <p className="font-medium">{order.paid_at ? formatDate(order.paid_at) : '—'}</p>
        </div>
      </div>

      {/* Pickup Info Section (BOPIS orders) */}
      {order.fulfillment_type === 'bopis' && (
        <Card className="border-zinc-700 bg-zinc-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Store className="h-4 w-4" />
              Información de Recogida
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Pickup location */}
            {order.pickup_location && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Ubicación de recogida</p>
                  <p className="font-medium">{order.pickup_location}</p>
                </div>
              </div>
            )}

            {order.pickup_branch && (
              <div className="flex items-start gap-2 text-sm">
                <Store className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Sucursal</p>
                  <p className="font-medium">{order.pickup_branch.name}</p>
                </div>
              </div>
            )}

            {/* Signature status */}
            <div className="flex items-start gap-2 text-sm">
              <PenLine className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Firma de recogida</p>
                {order.signature_url ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <p className="font-medium text-green-400">
                      Entrega confirmada
                    </p>
                    {order.completed_at && (
                      <span className="text-xs text-muted-foreground">
                        ({formatDate(order.completed_at)})
                      </span>
                    )}
                  </div>
                ) : order.status === 'ready_for_pickup' ? (
                  <p className="text-yellow-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Pendiente de firma
                  </p>
                ) : (
                  <p className="text-muted-foreground">—</p>
                )}
              </div>
            </div>

            {/* QR Code button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 w-full border-zinc-600 hover:bg-zinc-700"
              onClick={() => onShowQr(order)}
            >
              <QrCode className="h-4 w-4" />
              Ver Código QR para el Cliente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Status Timeline */}
      <StatusTimeline order={order} />

      {/* Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            Artículos ({order.items?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {order.items?.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
              {item.variant?.product?.image_url ? (
                <img
                  src={item.variant.product.image_url}
                  alt={item.variant.product.name}
                  className="h-10 w-10 rounded-lg object-cover flex-shrink-0 bg-muted"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.variant?.product?.name || 'Producto'}</p>
                <p className="text-xs text-muted-foreground">
                  SKU: {item.variant?.sku || '—'}
                  {item.is_picked && (
                    <span className="text-green-500 ml-2">
                      <CheckCircle2 className="h-3 w-3 inline mr-0.5" />
                      Surtido
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right ml-3 flex-shrink-0">
                <p className="tabular-nums">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                <p className="font-medium tabular-nums">{formatCurrency(item.subtotal)}</p>
              </div>
            </div>
          ))}

          {/* Totals */}
          <div className="pt-2 space-y-1">
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Descuento</span>
                <span className="tabular-nums">-{formatCurrency(order.discount_amount)}</span>
              </div>
            )}
            {order.tax_amount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Impuestos</span>
                <span className="tabular-nums">{formatCurrency(order.tax_amount)}</span>
              </div>
            )}
            {order.shipping_cost > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Envío</span>
                <span className="tabular-nums">{formatCurrency(order.shipping_cost)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Address */}
      {(order.fulfillment_type === 'delivery' || order.fulfillment_type === 'ship_to_home') && order.shipping_address && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              Dirección de envío
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-0.5">
              {order.shipping_address.street && <p>{order.shipping_address.street}</p>}
              {order.shipping_address.neighborhood && <p>{order.shipping_address.neighborhood}</p>}
              {(order.shipping_address.city || order.shipping_address.state) && (
                <p>
                  {[order.shipping_address.city, order.shipping_address.state].filter(Boolean).join(', ')}
                </p>
              )}
              {order.shipping_address.zip_code && <p>C.P. {order.shipping_address.zip_code}</p>}
              {order.shipping_address.reference && (
                <p className="text-muted-foreground text-xs mt-1">Ref: {order.shipping_address.reference}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tracking Map — visible for out_for_delivery / delivered (non-BOPIS) */}
      {showTrackingMap && (
        <Card className="border-zinc-700 bg-zinc-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Navigation className="h-4 w-4" />
              Recorrido de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] rounded-xl overflow-hidden border border-zinc-700">
              <LazyTrackingMap
                orderId={order.id}
                destination={
                  order.shipping_address
                    ? {
                        lat: Number(order.shipping_address.latitude) || 23.6345,
                        lng: Number(order.shipping_address.longitude) || -102.5528,
                        label: order.shipping_address.street || 'Destino',
                      }
                    : undefined
                }
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {order.status === 'out_for_delivery'
                ? 'Ubicación en tiempo real del repartidor — se actualiza cada 15 segundos'
                : 'Ruta completa de la entrega'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delivery Proof — visible when delivered (non-BOPIS) */}
      {order.status === 'delivered' && order.fulfillment_type !== 'bopis' && (
        <Card className="border-zinc-700 bg-zinc-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Prueba de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proofLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : deliveryProof ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Recibió</p>
                      <p className="font-medium">{deliveryProof.recipient_name || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha de entrega</p>
                      <p className="font-medium">{formatDate(deliveryProof.delivered_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">GPS de entrega</p>
                      <p className="font-mono text-xs">{Number(deliveryProof.latitude).toFixed(6)}, {Number(deliveryProof.longitude).toFixed(6)}</p>
                    </div>
                  </div>
                  {deliveryProof.employee?.name && (
                    <div className="flex items-start gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Repartidor</p>
                        <p className="font-medium">{deliveryProof.employee.name}</p>
                      </div>
                    </div>
                  )}
                </div>
                {deliveryProof.photo_url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Camera className="h-3 w-3" /> Foto de evidencia
                    </p>
                    <img
                      src={deliveryProof.photo_url}
                      alt="Prueba de entrega"
                      className="rounded-lg border border-zinc-700 max-h-48 object-cover w-full"
                    />
                  </div>
                )}
                {deliveryProof.notes && (
                  <p className="text-xs text-muted-foreground italic">"{deliveryProof.notes}"</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No se registró prueba de entrega</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {!isTerminal && (
        <div className="flex items-center gap-2 pt-2 border-t">
          {nextAction && (
            <Button
              onClick={() => onUpdateStatus(order.id, nextAction.nextStatus)}
              disabled={actionLoading}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {actionLoading ? 'Procesando...' : nextAction.label}
            </Button>
          )}

          {/* QR button in action bar for BOPIS orders */}
          {order.fulfillment_type === 'bopis' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onShowQr(order)}
            >
              <QrCode className="h-4 w-4" />
              QR
            </Button>
          )}

          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 ml-auto"
            onClick={() => onCancel(order.id)}
            disabled={actionLoading}
          >
            <XCircle className="h-4 w-4" />
            Cancelar Pedido
          </Button>
        </div>
      )}
    </>
  );
}
