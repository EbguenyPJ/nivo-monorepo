'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Separator } from '@nivo/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Circle, Clock, Loader2, Package, Truck } from 'lucide-react';
import { apiClient } from '@/lib/api';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Pendiente de Pago', color: 'bg-yellow-100 text-yellow-800' },
  paid: { label: 'Pagado', color: 'bg-blue-100 text-blue-800' },
  picking: { label: 'Preparando', color: 'bg-orange-100 text-orange-800' },
  packed: { label: 'Empacado', color: 'bg-purple-100 text-purple-800' },
  ready_for_pickup: { label: 'Listo para Recoger', color: 'bg-green-100 text-green-800' },
  picked_up: { label: 'Recogido', color: 'bg-gray-100 text-gray-800' },
  out_for_delivery: { label: 'En Camino', color: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
};

const BOPIS_FLOW = ['paid', 'picking', 'packed', 'ready_for_pickup', 'picked_up'];
const DELIVERY_FLOW = ['paid', 'picking', 'packed', 'out_for_delivery', 'delivered'];

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`/mobile/orders/${id}`).then((r) => {
      setOrder(r.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Link href="/"><h1 className="text-2xl font-bold text-primary">Mi Zapatería</h1></Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Pedido no encontrado.</p>
        </main>
      </div>
    );
  }

  const folio = `ORD-${String(order.order_number).padStart(5, '0')}`;
  const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' };
  const flow = order.fulfillment_type === 'bopis' ? BOPIS_FLOW : DELIVERY_FLOW;
  const currentIdx = flow.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/"><h1 className="text-2xl font-bold text-primary">Mi Zapatería</h1></Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold">{folio}</h2>
          <Badge className={`mt-2 ${statusInfo.color}`}>{statusInfo.label}</Badge>
          <p className="text-sm text-muted-foreground mt-2">
            {new Date(order.created_at).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>

        {/* Status Timeline */}
        {!isCancelled && (
          <Card className="mb-6">
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Estado del pedido</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-0">
                {flow.map((step, idx) => {
                  const stepInfo = STATUS_MAP[step];
                  const isCompleted = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div key={step} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        {isCompleted ? (
                          <CheckCircle2 className={`h-6 w-6 ${isCurrent ? 'text-primary' : 'text-green-500'}`} />
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground/30" />
                        )}
                        {idx < flow.length - 1 && (
                          <div className={`w-0.5 h-8 ${isCompleted ? 'bg-green-500' : 'bg-muted-foreground/20'}`} />
                        )}
                      </div>
                      <div className={`pb-6 ${isCompleted ? '' : 'opacity-40'}`}>
                        <p className={`font-medium ${isCurrent ? 'text-primary' : ''}`}>
                          {stepInfo?.label || step}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery in progress message */}
        {order.status === 'out_for_delivery' && (
          <Card className="mb-6 border-indigo-200 bg-indigo-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Truck className="h-6 w-6 text-indigo-600" />
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-indigo-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="font-medium text-indigo-900">Tu pedido está en camino</p>
                  <p className="text-sm text-indigo-700">El repartidor se dirige a tu ubicación.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fulfillment info */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {order.fulfillment_type === 'bopis' ? (
                <>
                  <Package className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Recoger en Tienda</p>
                    {order.pickup_branch && <p className="text-sm text-muted-foreground">{order.pickup_branch.name}</p>}
                  </div>
                </>
              ) : (
                <>
                  <Truck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Envío a Domicilio</p>
                    {order.shipping_address && (
                      <p className="text-sm text-muted-foreground">
                        {[order.shipping_address.street, order.shipping_address.city, order.shipping_address.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="mb-6">
          <CardHeader><CardTitle>Artículos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {order.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{item.variant?.product?.name || 'Producto'}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.variant?.sku} x{item.quantity}
                  </p>
                </div>
                <p className="font-medium">${Number(item.subtotal).toFixed(2)}</p>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${Number(order.total_amount).toFixed(2)}</span>
            </div>
            {Number(order.shipping_cost) > 0 && (
              <div className="flex justify-between text-sm">
                <span>Envío</span>
                <span>${Number(order.shipping_cost).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>${(Number(order.total_amount) + Number(order.shipping_cost || 0)).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {order.notes && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Link href="/products"><Button variant="outline">Seguir comprando</Button></Link>
        </div>
      </main>
    </div>
  );
}
