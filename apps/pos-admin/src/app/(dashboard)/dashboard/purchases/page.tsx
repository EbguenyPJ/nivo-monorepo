'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Badge, Skeleton, Input,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@nivo/ui';
import {
  Search, Plus, Eye, Package, Truck, ShoppingBag,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, X, Minus,
  Clock, XCircle, DollarSign, FileText, Users, CreditCard,
  Building2, Send, RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { formatCurrency, formatDate } from '@/lib/date-utils';

// ─── Types ───────────────────────────────────────────────────────

interface SupplierRow {
  id: string;
  name: string;
  tax_id: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  credit_days: number;
  notes: string | null;
  is_active: boolean;
}

interface OrderRow {
  id: string;
  folio: string;
  supplier_name: string;
  supplier_id: string;
  branch_name: string;
  branch_id: string;
  status: string;
  total_cost: number;
  invoice_number: string | null;
  expected_date: string | null;
  received_at: string | null;
  created_by_name: string;
  created_at: string;
  item_count: number;
  total_ordered: number;
}

interface OrderDetailItem {
  id: string;
  variant_id: string;
  ordered_quantity: number;
  received_quantity: number | null;
  unit_cost: number;
  difference: number | null;
  product_name: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  image_url: string | null;
  current_cost: number;
}

interface OrderDetail {
  id: string;
  folio: string;
  status: string;
  supplier_id: string;
  supplier_name: string;
  supplier_credit_days: number;
  branch_id: string;
  branch_name: string;
  total_cost: number;
  invoice_number: string | null;
  expected_date: string | null;
  received_at: string | null;
  notes: string | null;
  discrepancy_notes: string | null;
  created_by_name: string;
  received_by_name: string | null;
  created_at: string;
  items: OrderDetailItem[];
}

interface AccountPayableRow {
  id: string;
  supplier_name: string;
  supplier_id: string;
  purchase_order_id: string;
  folio: string;
  amount: number;
  paid_amount: number;
  balance: number;
  due_date: string;
  status: string;
  overdue_days: number;
  received_at: string | null;
  created_at: string;
}

interface Kpis {
  total_payable: number;
  overdue_count: number;
  pending_orders: number;
  month_purchases: number;
}

interface VariantSearchResult {
  variant_id: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  product_name: string;
  image_url: string | null;
  current_cost: number;
}

interface ProductSearchResult {
  product_id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  variants: {
    variant_id: string;
    sku: string;
    barcode: string | null;
    attributes: Record<string, string>;
    current_cost: number;
    image_url: string | null;
  }[];
}

interface NewOrderItem {
  variant_id: string;
  product_name: string;
  sku: string;
  attributes: Record<string, string>;
  image_url: string | null;
  quantity: number;
  unit_cost: number;
}

const PAGE_SIZE = 20;

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  ordered: { label: 'Pedida', variant: 'default' },
  partial: { label: 'Parcial', variant: 'outline' },
  received: { label: 'Recibida', variant: 'default' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
};

const apStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendiente', variant: 'outline' },
  partial: { label: 'Abono parcial', variant: 'secondary' },
  paid: { label: 'Pagada', variant: 'default' },
  overdue: { label: 'Vencida', variant: 'destructive' },
};

function ItemThumb({ src, size = 'sm' }: { src: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'h-12 w-12' : 'h-8 w-8';
  if (!src) {
    return (
      <div className={`${dim} rounded bg-muted flex items-center justify-center flex-shrink-0`}>
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img src={src} alt="" className={`${dim} rounded object-cover flex-shrink-0`} />
  );
}

function variantLabel(attrs: Record<string, string>): string {
  return Object.values(attrs || {}).filter(Boolean).join(' · ') || '—';
}

// ═══════════════════════════════════════════════════════════════════
//  Main Page
// ═══════════════════════════════════════════════════════════════════

export default function PurchasesPage() {
  const { selectedBranchId, isGeneralSelected, branches } = useBranchStore();

  // ─── Main tab ─────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'orders' | 'suppliers' | 'payables'>('orders');

  // ─── KPIs ─────────────────────────────────────────────────────
  const [kpis, setKpis] = useState<Kpis | null>(null);

  // ─── Orders list ──────────────────────────────────────────────
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(0);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  // ─── Suppliers ────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');

  // ─── Accounts Payable ─────────────────────────────────────────
  const [payables, setPayables] = useState<AccountPayableRow[]>([]);
  const [payablesLoading, setPayablesLoading] = useState(false);
  const [payablesTotal, setPayablesTotal] = useState(0);
  const [payableStatusFilter, setPayableStatusFilter] = useState('all');
  const [payableSearch, setPayableSearch] = useState('');

  // ─── Dialogs ──────────────────────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  const [receptionOpen, setReceptionOpen] = useState(false);
  const [receptionOrder, setReceptionOrder] = useState<OrderDetail | null>(null);
  const [receptionQtys, setReceptionQtys] = useState<Record<string, number>>({});
  const [receptionProcessing, setReceptionProcessing] = useState(false);

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRow | null>(null);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState<AccountPayableRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // ─── Fetch KPIs ────────────────────────────────────────────────

  const fetchKpis = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (supplierFilter !== 'all') params.supplier_id = supplierFilter;
      if (!isGeneralSelected && selectedBranchId) params.branch_id = selectedBranchId;
      const res = await apiClient.get('/purchasing/orders/kpis', { params });
      setKpis(res.data);
    } catch {
      setKpis(null);
    }
  }, [supplierFilter, selectedBranchId, isGeneralSelected]);

  // ─── Fetch Orders ──────────────────────────────────────────────

  const fetchOrders = useCallback(async (page = 0) => {
    setOrdersLoading(true);
    try {
      const params: Record<string, string> = {};
      if (!isGeneralSelected && selectedBranchId) params.branch_id = selectedBranchId;
      if (orderStatusFilter !== 'all') params.status = orderStatusFilter;
      if (supplierFilter !== 'all') params.supplier_id = supplierFilter;
      params.limit = String(PAGE_SIZE);
      params.offset = String(page * PAGE_SIZE);
      const res = await apiClient.get('/purchasing/orders', { params });
      setOrders(res.data.data || []);
      setOrdersTotal(res.data.total || 0);
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [selectedBranchId, isGeneralSelected, orderStatusFilter, supplierFilter]);

  // ─── Fetch Suppliers ───────────────────────────────────────────

  const fetchSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      const params: Record<string, string> = {};
      if (supplierSearch) params.search = supplierSearch;
      const res = await apiClient.get('/purchasing/suppliers', { params });
      setSuppliers(res.data || []);
    } catch {
      setSuppliers([]);
    } finally {
      setSuppliersLoading(false);
    }
  }, [supplierSearch]);

  // ─── Fetch Payables ────────────────────────────────────────────

  const fetchPayables = useCallback(async () => {
    setPayablesLoading(true);
    try {
      const params: Record<string, string> = {};
      if (supplierFilter !== 'all') params.supplier_id = supplierFilter;
      if (!isGeneralSelected && selectedBranchId) params.branch_id = selectedBranchId;
      if (payableStatusFilter !== 'all') params.status = payableStatusFilter;
      if (payableSearch.trim()) params.search = payableSearch.trim();
      params.limit = '50';
      const res = await apiClient.get('/purchasing/accounts-payable', { params });
      setPayables(res.data.data || []);
      setPayablesTotal(res.data.total || 0);
    } catch {
      setPayables([]);
    } finally {
      setPayablesLoading(false);
    }
  }, [supplierFilter, selectedBranchId, isGeneralSelected, payableStatusFilter, payableSearch]);

  // ─── Effects ───────────────────────────────────────────────────

  useEffect(() => {
    fetchKpis();
    fetchOrders(0);
    setOrdersPage(0);
    fetchSuppliers();
  }, [fetchKpis, fetchOrders, fetchSuppliers]);

  useEffect(() => {
    if (mainTab === 'payables') fetchPayables();
  }, [mainTab, fetchPayables]);

  useEffect(() => {
    if (ordersPage > 0) fetchOrders(ordersPage);
  }, [ordersPage]);

  // ─── Order Detail ──────────────────────────────────────────────

  const openDetail = async (orderId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiClient.get('/purchasing/orders/detail', { params: { order_id: orderId } });
      setDetail(res.data);
    } catch {
      console.error('Failed to fetch order detail');
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Reception ─────────────────────────────────────────────────

  const openReception = async (orderId: string) => {
    setReceptionOpen(true);
    setDetailLoading(true);
    setReceptionOrder(null);
    try {
      const res = await apiClient.get('/purchasing/orders/detail', { params: { order_id: orderId } });
      setReceptionOrder(res.data);
      const qtys: Record<string, number> = {};
      for (const item of res.data.items) {
        qtys[item.id] = 0;
      }
      setReceptionQtys(qtys);
    } catch {
      console.error('Failed to fetch order detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReception = async () => {
    if (!receptionOrder) return;
    setReceptionProcessing(true);
    try {
      await apiClient.post('/purchasing/orders/receive', {
        order_id: receptionOrder.id,
        items: receptionOrder.items.map((item) => ({
          item_id: item.id,
          received_quantity: receptionQtys[item.id] ?? 0,
        })),
      });
      setReceptionOpen(false);
      fetchOrders(ordersPage);
      fetchKpis();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al recibir mercancía');
    } finally {
      setReceptionProcessing(false);
    }
  };

  // ─── Order Actions ─────────────────────────────────────────────

  const confirmOrder = async (orderId: string) => {
    try {
      await apiClient.post('/purchasing/orders/confirm', { order_id: orderId });
      setDetailOpen(false);
      fetchOrders(ordersPage);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al confirmar orden');
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await apiClient.post('/purchasing/orders/cancel', { order_id: orderId });
      setDetailOpen(false);
      fetchOrders(ordersPage);
      fetchKpis();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al cancelar orden');
    }
  };

  // ─── Payment ───────────────────────────────────────────────────

  const openPaymentDialog = (ap: AccountPayableRow) => {
    setPaymentAccount(ap);
    setPaymentAmount('');
    setPaymentMethod('transfer');
    setPaymentReference('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentDialogOpen(true);
  };

  const submitPayment = async () => {
    if (!paymentAccount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    setPaymentProcessing(true);
    try {
      await apiClient.post('/purchasing/accounts-payable/payment', {
        account_id: paymentAccount.id,
        amount,
        payment_method: paymentMethod,
        reference: paymentReference || undefined,
        payment_date: paymentDate || undefined,
      });
      setPaymentDialogOpen(false);
      fetchPayables();
      fetchKpis();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al registrar pago');
    } finally {
      setPaymentProcessing(false);
    }
  };

  // ─── Supplier CRUD ─────────────────────────────────────────────

  const openNewSupplier = () => {
    setEditingSupplier(null);
    setSupplierDialogOpen(true);
  };

  const openEditSupplier = (s: SupplierRow) => {
    setEditingSupplier(s);
    setSupplierDialogOpen(true);
  };

  const onSupplierSaved = () => {
    setSupplierDialogOpen(false);
    fetchSuppliers();
  };

  const toggleSupplier = async (id: string) => {
    try {
      await apiClient.patch(`/purchasing/suppliers/${id}/toggle-status`);
      fetchSuppliers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error');
    }
  };

  // ─── Create callback ──────────────────────────────────────────

  const onOrderCreated = () => {
    setCreateOpen(false);
    fetchOrders(0);
    setOrdersPage(0);
    fetchKpis();
  };

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  const totalPages = Math.ceil(ordersTotal / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compras</h1>
          <p className="text-sm text-muted-foreground">Órdenes de compra, proveedores y cuentas por pagar</p>
        </div>
        <div className="flex gap-2">
          {mainTab === 'orders' && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva Orden
            </Button>
          )}
          {mainTab === 'suppliers' && (
            <Button size="sm" onClick={openNewSupplier}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo Proveedor
            </Button>
          )}
          {mainTab === 'payables' && (
            <Button size="sm" onClick={() => {
              const firstUnpaid = payables.find((ap) => ap.status !== 'paid');
              if (firstUnpaid) openPaymentDialog(firstUnpaid);
            }} disabled={!payables.some((ap) => ap.status !== 'paid')}>
              <DollarSign className="h-4 w-4 mr-1.5" />
              Registrar Pago
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total por Pagar</p>
                <p className="text-2xl font-bold">{kpis ? formatCurrency(kpis.total_payable) : '—'}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cuentas Vencidas</p>
                <p className="text-2xl font-bold">{kpis?.overdue_count ?? '—'}</p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${kpis && kpis.overdue_count > 0 ? 'text-destructive' : 'text-muted-foreground/30'}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Pendientes</p>
                <p className="text-2xl font-bold">{kpis?.pending_orders ?? '—'}</p>
              </div>
              <Truck className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compras del Mes</p>
                <p className="text-2xl font-bold">{kpis ? formatCurrency(kpis.month_purchases) : '—'}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="orders">Órdenes de Compra</TabsTrigger>
            <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
            <TabsTrigger value="payables">Cuentas por Pagar</TabsTrigger>
          </TabsList>

          {mainTab === 'orders' && (
            <div className="flex gap-2">
              <Select value={supplierFilter} onValueChange={(v) => { setSupplierFilter(v); setOrdersPage(0); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={orderStatusFilter} onValueChange={(v) => { setOrderStatusFilter(v); setOrdersPage(0); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="ordered">Pedida</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="received">Recibida</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ─── Orders Tab ─────────────────────────────────────── */}
        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Folio</th>
                      <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                      <th className="px-4 py-3 text-left font-medium">Sucursal</th>
                      <th className="px-4 py-3 text-left font-medium">Estado</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th className="px-4 py-3 text-right font-medium">Artículos</th>
                      <th className="px-4 py-3 text-left font-medium">Fecha</th>
                      <th className="px-4 py-3 text-center font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                          ))}
                        </tr>
                      ))
                    ) : orders.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No hay órdenes de compra</td></tr>
                    ) : (
                      orders.map((o) => {
                        const sc = statusConfig[o.status] || statusConfig.draft;
                        return (
                          <tr key={o.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-mono font-medium">{o.folio}</td>
                            <td className="px-4 py-3">{o.supplier_name}</td>
                            <td className="px-4 py-3">{o.branch_name}</td>
                            <td className="px-4 py-3"><Badge variant={sc.variant}>{sc.label}</Badge></td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(o.total_cost)}</td>
                            <td className="px-4 py-3 text-right">{o.total_ordered} pzas</td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDate(o.created_at)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openDetail(o.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {(o.status === 'ordered' || o.status === 'partial') && (
                                  <Button variant="ghost" size="sm" onClick={() => openReception(o.id)} title="Recibir mercancía">
                                    <Package className="h-4 w-4" />
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
                  <span className="text-sm text-muted-foreground">{ordersTotal} órdenes</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={ordersPage === 0} onClick={() => setOrdersPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{ordersPage + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={ordersPage >= totalPages - 1} onClick={() => setOrdersPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Suppliers Tab ──────────────────────────────────── */}
        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Catálogo de Proveedores</CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar proveedor..."
                    className="pl-9 w-[250px]"
                    value={supplierSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Nombre</th>
                    <th className="px-4 py-3 text-left font-medium">RFC</th>
                    <th className="px-4 py-3 text-left font-medium">Contacto</th>
                    <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                    <th className="px-4 py-3 text-center font-medium">Días Crédito</th>
                    <th className="px-4 py-3 text-center font-medium">Estado</th>
                    <th className="px-4 py-3 text-center font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : suppliers.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No hay proveedores registrados</td></tr>
                  ) : (
                    suppliers.map((s) => (
                      <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">{s.tax_id || '—'}</td>
                        <td className="px-4 py-3">{s.contact_name || '—'}</td>
                        <td className="px-4 py-3">{s.phone || '—'}</td>
                        <td className="px-4 py-3 text-center">{s.credit_days}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={s.is_active ? 'default' : 'secondary'}>
                            {s.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditSupplier(s)}>
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => toggleSupplier(s.id)}>
                              {s.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Payables Tab ───────────────────────────────────── */}
        <TabsContent value="payables" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proveedor..."
                className="pl-9"
                value={payableSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayableSearch(e.target.value)}
              />
            </div>
            <Select value={payableStatusFilter} onValueChange={setPayableStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="overdue">Vencidas</SelectItem>
                <SelectItem value="partial">Abono parcial</SelectItem>
                <SelectItem value="paid">Liquidadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Folio OC</th>
                      <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                      <th className="px-4 py-3 text-left font-medium">Fecha Compra</th>
                      <th className="px-4 py-3 text-left font-medium">Fecha Vencimiento</th>
                      <th className="px-4 py-3 text-right font-medium">Monto Original</th>
                      <th className="px-4 py-3 text-right font-medium">Saldo Pendiente</th>
                      <th className="px-4 py-3 text-center font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payablesLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          {Array.from({ length: 7 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                          ))}
                        </tr>
                      ))
                    ) : payables.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No hay cuentas por pagar</td></tr>
                    ) : (
                      payables.map((ap) => {
                        const isOverdue = ap.status === 'overdue';
                        const isPaid = ap.status === 'paid';

                        return (
                          <tr
                            key={ap.id}
                            className={`border-b transition-colors ${
                              isOverdue
                                ? 'bg-destructive/5 hover:bg-destructive/10'
                                : 'hover:bg-muted/30'
                            }`}
                          >
                            <td className="px-4 py-3 font-mono font-medium">{ap.folio}</td>
                            <td className="px-4 py-3 font-medium">{ap.supplier_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {ap.received_at ? formatDate(ap.received_at) : ap.created_at ? formatDate(ap.created_at) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                                  {ap.due_date}
                                </span>
                                {isOverdue && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                                    {ap.overdue_days}d atraso
                                  </Badge>
                                )}
                                {isPaid && (
                                  <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                    Liquidada
                                  </Badge>
                                )}
                                {ap.status === 'partial' && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Abono parcial
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">{formatCurrency(ap.amount)}</td>
                            <td className={`px-4 py-3 text-right font-mono font-bold ${
                              isPaid ? 'text-green-600' : isOverdue ? 'text-destructive' : ''
                            }`}>
                              {isPaid ? '$0.00' : formatCurrency(ap.balance)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {!isPaid && (
                                <Button
                                  variant={isOverdue ? 'destructive' : 'outline'}
                                  size="sm"
                                  onClick={() => openPaymentDialog(ap)}
                                  className="gap-1"
                                >
                                  <DollarSign className="h-3.5 w-3.5" />
                                  Pagar
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ Order Detail Dialog ═══════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail ? `${detail.folio} — ${detail.supplier_name}` : 'Detalle de Orden'}
            </DialogTitle>
            <DialogDescription>
              {detail ? `Sucursal: ${detail.branch_name} · Creada por: ${detail.created_by_name}` : ''}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="flex items-center gap-3">
                <Badge variant={statusConfig[detail.status]?.variant || 'secondary'}>
                  {statusConfig[detail.status]?.label || detail.status}
                </Badge>
                {detail.invoice_number && (
                  <span className="text-sm text-muted-foreground">Factura: {detail.invoice_number}</span>
                )}
                {detail.expected_date && (
                  <span className="text-sm text-muted-foreground">Entrega esperada: {detail.expected_date}</span>
                )}
              </div>

              {detail.notes && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">{detail.notes}</p>
              )}

              {detail.discrepancy_notes && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive mb-1">Discrepancias en recepción</p>
                    <pre className="text-xs whitespace-pre-wrap">{detail.discrepancy_notes}</pre>
                  </div>
                </div>
              )}

              {/* Items table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-3 py-2 text-left font-medium">Artículo</th>
                      <th className="px-3 py-2 text-right font-medium">Costo Unit.</th>
                      <th className="px-3 py-2 text-right font-medium">Pedido</th>
                      <th className="px-3 py-2 text-right font-medium">Recibido</th>
                      <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ItemThumb src={item.image_url} />
                            <div>
                              <p className="font-medium text-xs">{item.product_name}</p>
                              <p className="text-xs text-muted-foreground">{variantLabel(item.attributes)} · {item.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(item.unit_cost)}</td>
                        <td className="px-3 py-2 text-right">{item.ordered_quantity}</td>
                        <td className="px-3 py-2 text-right">
                          {item.received_quantity !== null ? (
                            <span className={item.difference !== 0 ? 'text-destructive font-bold' : 'text-green-600 font-bold'}>
                              {item.received_quantity}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(item.ordered_quantity * Number(item.unit_cost))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td colSpan={4} className="px-3 py-2 text-right font-bold">Total</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{formatCurrency(detail.total_cost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}

          {detail && (
            <DialogFooter className="gap-2">
              {detail.status === 'draft' && (
                <>
                  <Button variant="destructive" size="sm" onClick={() => cancelOrder(detail.id)}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={() => confirmOrder(detail.id)}>
                    <Send className="h-4 w-4 mr-1" />
                    Confirmar Pedido
                  </Button>
                </>
              )}
              {(detail.status === 'ordered' || detail.status === 'partial') && (
                <Button size="sm" onClick={() => { setDetailOpen(false); openReception(detail.id); }}>
                  <Package className="h-4 w-4 mr-1" />
                  Recibir Mercancía
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Reception Dialog ══════════════════════════════════════ */}
      <Dialog open={receptionOpen} onOpenChange={setReceptionOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Recepción de Mercancía {receptionOrder ? `— ${receptionOrder.folio}` : ''}
            </DialogTitle>
            <DialogDescription>
              Ingrese las cantidades recibidas para cada artículo. Use el escáner o ingrese manualmente.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : receptionOrder ? (
            <div className="space-y-3">
              {receptionOrder.items.map((item) => {
                const recvQty = receptionQtys[item.id] ?? 0;
                const prevReceived = item.received_quantity ?? 0;
                const remaining = item.ordered_quantity - prevReceived;
                const matches = recvQty === remaining;
                const over = recvQty > remaining;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      matches ? 'border-green-300 bg-green-50 dark:bg-green-950/20' :
                      over ? 'border-destructive bg-destructive/5' :
                      'border-border'
                    }`}
                  >
                    <ItemThumb src={item.image_url} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{variantLabel(item.attributes)} · {item.sku}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pedido: {item.ordered_quantity}
                        {prevReceived > 0 && <span className="ml-1">· Ya recibido: {prevReceived}</span>}
                        {prevReceived > 0 && <span className="ml-1">· Pendiente: {remaining}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setReceptionQtys((prev) => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1) }))}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        className="w-16 text-center h-8"
                        type="number"
                        min={0}
                        value={recvQty}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setReceptionQtys((prev) => ({ ...prev, [item.id]: parseInt(e.target.value) || 0 }))
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setReceptionQtys((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      {matches && <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />}
                      {over && <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReceptionOpen(false)}>Cancelar</Button>
            <Button onClick={submitReception} disabled={receptionProcessing}>
              {receptionProcessing ? 'Procesando...' : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Confirmar Recepción
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Create Order Dialog ═══════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Orden de Compra</DialogTitle>
            <DialogDescription>Seleccione proveedor, sucursal destino y los artículos a pedir.</DialogDescription>
          </DialogHeader>
          {createOpen && (
            <CreateOrderFlow
              suppliers={suppliers}
              onCreated={onOrderCreated}
              onClose={() => setCreateOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Supplier Dialog ═══════════════════════════════════════ */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
          </DialogHeader>
          {supplierDialogOpen && (
            <SupplierForm
              supplier={editingSupplier}
              onSaved={onSupplierSaved}
              onClose={() => setSupplierDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Payment Dialog ════════════════════════════════════════ */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {paymentAccount && `${paymentAccount.supplier_name} — ${paymentAccount.folio}`}
            </DialogDescription>
          </DialogHeader>
          {paymentAccount && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">Monto original</p>
                  <p className="font-mono font-medium">{formatCurrency(paymentAccount.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                  <p className="font-mono font-bold text-destructive">{formatCurrency(paymentAccount.balance)}</p>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Monto a pagar *</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentAmount(e.target.value)}
                    min={0}
                    max={paymentAccount.balance}
                    step="0.01"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaymentAmount(String(paymentAccount.balance))}
                    className="whitespace-nowrap"
                  >
                    Liquidar total
                  </Button>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Metodo de pago *</label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'transfer')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                    <SelectItem value="cash">Caja Chica</SelectItem>
                  </SelectContent>
                </Select>
                {paymentMethod === 'cash' && (
                  <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Se descontara del arqueo de caja de la sesion activa
                  </p>
                )}
              </div>

              {/* Date + Reference */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha de pago</label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Referencia / Comprobante</label>
                  <Input
                    placeholder="No. transferencia..."
                    value={paymentReference}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentReference(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
                <Button
                  onClick={submitPayment}
                  disabled={paymentProcessing || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="gap-1.5"
                >
                  {paymentProcessing ? 'Procesando...' : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirmar Pago
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Create Order Flow (sub-component)
// ═══════════════════════════════════════════════════════════════════

function CreateOrderFlow({
  suppliers,
  onCreated,
  onClose,
}: {
  suppliers: SupplierRow[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const { selectedBranchId, branches } = useBranchStore();
  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState(selectedBranchId || '');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<NewOrderItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeBranches = branches.filter((b) => b.is_active);
  const activeSuppliers = suppliers.filter((s) => s.is_active);

  // ─── Product search ────────────────────────────────────────────

  const doSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await apiClient.get('/purchasing/search-products', { params: { search: q } });
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(search), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search, doSearch]);

  // ─── Batch size selection (model → sizes grid) ─────────────────

  const openSizeGrid = (product: ProductSearchResult) => {
    setSelectedProduct(product);
  };

  const addVariantFromGrid = (variant: ProductSearchResult['variants'][0], quantity: number, unitCost: number) => {
    if (quantity <= 0) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.variant_id === variant.variant_id);
      if (existing) {
        return prev.map((i) =>
          i.variant_id === variant.variant_id ? { ...i, quantity: i.quantity + quantity, unit_cost: unitCost } : i,
        );
      }
      return [...prev, {
        variant_id: variant.variant_id,
        product_name: selectedProduct?.product_name || '',
        sku: variant.sku,
        attributes: variant.attributes,
        image_url: variant.image_url || selectedProduct?.image_url || null,
        quantity,
        unit_cost: unitCost,
      }];
    });
  };

  const updateItemQty = (variantId: string, delta: number) => {
    setItems((prev) => prev.map((i) =>
      i.variant_id === variantId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i,
    ));
  };

  const updateItemCost = (variantId: string, cost: number) => {
    setItems((prev) => prev.map((i) =>
      i.variant_id === variantId ? { ...i, unit_cost: cost } : i,
    ));
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  // ─── Submit ────────────────────────────────────────────────────

  const totalCost = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

  const submit = async () => {
    if (!supplierId || !branchId || items.length === 0) return;
    setSubmitting(true);
    try {
      const createRes = await apiClient.post('/purchasing/orders/create', {
        supplier_id: supplierId,
        branch_id: branchId,
        invoice_number: invoiceNumber || undefined,
        expected_date: expectedDate || undefined,
        notes: notes || undefined,
        items: items.map((i) => ({ variant_id: i.variant_id, ordered_quantity: i.quantity, unit_cost: i.unit_cost })),
      });
      // Auto-confirm after creation
      const orderId = createRes.data?.id;
      if (orderId) {
        await apiClient.post('/purchasing/orders/confirm', { order_id: orderId });
      }
      onCreated();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al crear orden de compra');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Size Grid Sub-view ────────────────────────────────────────

  if (selectedProduct) {
    return (
      <SizeGridPicker
        product={selectedProduct}
        onAddItems={(variants) => {
          variants.forEach((v) => addVariantFromGrid(v.variant, v.quantity, v.unit_cost));
          setSelectedProduct(null);
        }}
        onBack={() => setSelectedProduct(null)}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Supplier + Branch row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Proveedor</label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proveedor" />
              </SelectTrigger>
              <SelectContent>
                {activeSuppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Sucursal destino</label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar sucursal" />
              </SelectTrigger>
              <SelectContent>
                {activeBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Invoice + Expected date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">No. Factura (opcional)</label>
            <Input
              value={invoiceNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInvoiceNumber(e.target.value)}
              placeholder="Referencia del proveedor"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fecha esperada (opcional)</label>
            <Input
              type="date"
              value={expectedDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExpectedDate(e.target.value)}
            />
          </div>
        </div>

        {/* Search */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Buscar modelo</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nombre, SKU o código de barras..."
              className="pl-9"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Search results — grouped by product */}
        {searchResults.length > 0 && (
          <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
            {searchResults.map((p) => (
              <div
                key={p.product_id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => openSizeGrid(p)}
              >
                <ItemThumb src={p.image_url} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.product_name}</p>
                  <p className="text-xs text-muted-foreground">{p.brand_name} · {p.variants.length} variantes</p>
                </div>
                <span className="text-xs text-muted-foreground">Seleccionar tallas →</span>
              </div>
            ))}
          </div>
        )}
        {searching && <p className="text-sm text-muted-foreground text-center py-2">Buscando...</p>}

        {/* Selected items */}
        {items.length > 0 && (
          <div className="border rounded-lg divide-y">
            <div className="px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground flex">
              <span className="flex-1">Artículo</span>
              <span className="w-24 text-right">Costo Unit.</span>
              <span className="w-20 text-center">Cantidad</span>
              <span className="w-24 text-right">Subtotal</span>
              <span className="w-8" />
            </div>
            {items.map((item) => (
              <div key={item.variant_id} className="flex items-center gap-2 px-3 py-2">
                <ItemThumb src={item.image_url} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{variantLabel(item.attributes)} · {item.sku}</p>
                </div>
                <Input
                  className="w-24 text-right h-7 text-sm"
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.unit_cost}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateItemCost(item.variant_id, parseFloat(e.target.value) || 0)
                  }
                />
                <div className="flex items-center gap-1 w-20 justify-center">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateItemQty(item.variant_id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-mono w-6 text-center">{item.quantity}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => updateItemQty(item.variant_id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <span className="w-24 text-right font-mono text-sm">{formatCurrency(item.quantity * item.unit_cost)}</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeItem(item.variant_id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="px-3 py-2 bg-muted/30 flex justify-between font-bold">
              <span>Total ({items.reduce((s, i) => s + i.quantity, 0)} pzas)</span>
              <span className="font-mono">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas (opcional)</label>
          <Input
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
            placeholder="Observaciones de la orden..."
          />
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={submit}
          disabled={!supplierId || !branchId || items.length === 0 || submitting}
          className="gap-1.5"
        >
          {submitting ? 'Creando...' : (
            <>
              <Send className="h-4 w-4" />
              Crear y Confirmar
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Size Grid Picker — select quantities per size for a model
// ═══════════════════════════════════════════════════════════════════

function SizeGridPicker({
  product,
  onAddItems,
  onBack,
}: {
  product: ProductSearchResult;
  onAddItems: (items: { variant: ProductSearchResult['variants'][0]; quantity: number; unit_cost: number }[]) => void;
  onBack: () => void;
}) {
  // Group variants by Color
  const colorGroups = new Map<string, ProductSearchResult['variants']>();
  for (const v of product.variants) {
    const color = v.attributes?.['Color'] || 'Sin Color';
    if (!colorGroups.has(color)) colorGroups.set(color, []);
    colorGroups.get(color)!.push(v);
  }

  // State: quantity per variant_id, and shared unit_cost
  const [qtys, setQtys] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    product.variants.forEach((v) => { map[v.variant_id] = 0; });
    return map;
  });
  const [unitCost, setUnitCost] = useState(() => {
    return product.variants[0]?.current_cost || 0;
  });

  const totalQty = Object.values(qtys).reduce((s, q) => s + q, 0);

  const handleAdd = () => {
    const selected = product.variants
      .filter((v) => (qtys[v.variant_id] || 0) > 0)
      .map((v) => ({ variant: v, quantity: qtys[v.variant_id], unit_cost: unitCost }));
    if (selected.length > 0) onAddItems(selected);
    else onBack();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <div>
          <p className="font-bold text-sm">{product.product_name}</p>
          <p className="text-xs text-muted-foreground">{product.brand_name}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground">Costo unitario:</label>
        <Input
          className="w-32 h-8"
          type="number"
          min={0}
          step="0.01"
          value={unitCost}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUnitCost(parseFloat(e.target.value) || 0)}
        />
        <span className="text-xs text-muted-foreground">(último costo: {formatCurrency(product.variants[0]?.current_cost || 0)})</span>
      </div>

      {Array.from(colorGroups.entries()).map(([color, variants]) => (
        <div key={color} className="space-y-2">
          <p className="text-sm font-medium">{color}</p>
          <div className="flex flex-wrap gap-2">
            {variants
              .sort((a, b) => {
                const sA = parseFloat(a.attributes?.['Talla MX'] || '0');
                const sB = parseFloat(b.attributes?.['Talla MX'] || '0');
                return sA - sB;
              })
              .map((v) => {
                const size = v.attributes?.['Talla MX'] || v.attributes?.['Talla'] || v.sku;
                const qty = qtys[v.variant_id] || 0;
                return (
                  <div key={v.variant_id} className="flex flex-col items-center border rounded-lg p-2 min-w-[60px]">
                    <span className="text-xs font-medium mb-1">{size}</span>
                    <Input
                      className="w-12 h-7 text-center text-sm"
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setQtys((prev) => ({ ...prev, [v.variant_id]: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                );
              })}
          </div>
        </div>
      ))}

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onBack}>Cancelar</Button>
        <Button onClick={handleAdd} disabled={totalQty === 0}>
          Agregar {totalQty} {totalQty === 1 ? 'par' : 'pares'} — {formatCurrency(totalQty * unitCost)}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Supplier Form
// ═══════════════════════════════════════════════════════════════════

function SupplierForm({
  supplier,
  onSaved,
  onClose,
}: {
  supplier: SupplierRow | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(supplier?.name || '');
  const [taxId, setTaxId] = useState(supplier?.tax_id || '');
  const [contactName, setContactName] = useState(supplier?.contact_name || '');
  const [email, setEmail] = useState(supplier?.email || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [creditDays, setCreditDays] = useState(String(supplier?.credit_days ?? 0));
  const [notes, setNotes] = useState(supplier?.notes || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        tax_id: taxId.trim() || null,
        contact_name: contactName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        credit_days: parseInt(creditDays) || 0,
        notes: notes.trim() || null,
      };
      if (supplier) {
        await apiClient.put(`/purchasing/suppliers/${supplier.id}`, data);
      } else {
        await apiClient.post('/purchasing/suppliers', data);
      }
      onSaved();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al guardar proveedor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre *</label>
        <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Nombre del proveedor" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">RFC / NIT</label>
          <Input value={taxId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaxId(e.target.value)} placeholder="RFC del proveedor" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Días de Crédito</label>
          <Input type="number" min={0} value={creditDays} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreditDays(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Contacto</label>
          <Input value={contactName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactName(e.target.value)} placeholder="Nombre del contacto" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Teléfono</label>
          <Input value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} placeholder="Teléfono" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
        <Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="correo@proveedor.com" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas</label>
        <Input value={notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} placeholder="Observaciones..." />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} disabled={!name.trim() || saving}>
          {saving ? 'Guardando...' : (supplier ? 'Actualizar' : 'Crear Proveedor')}
        </Button>
      </DialogFooter>
    </div>
  );
}
