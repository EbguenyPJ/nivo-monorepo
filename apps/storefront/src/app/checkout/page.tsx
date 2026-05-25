'use client';

import { useEffect, useState } from 'react';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Separator,
} from '@nivo/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Store, Truck } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cart-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
  address: string;
}

interface ShippingOption {
  id: string;
  name: string;
  description: string | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  cost: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clear } = useCartStore();
  const { customer, token } = useAuthStore();
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const [fulfillment, setFulfillment] = useState<'bopis' | 'delivery'>('bopis');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [shippingMethods, setShippingMethods] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [address, setAddress] = useState({
    street: '', neighborhood: '', city: '', state: '', zip_code: '', country: 'Mexico', reference: '',
  });

  const shippingCost = fulfillment === 'delivery'
    ? shippingMethods.find((m) => m.id === selectedShipping)?.cost ?? 0
    : 0;
  const total = subtotal + shippingCost;

  useEffect(() => {
    apiClient.get('/branches').then((r) => {
      setBranches(r.data.filter((b: any) => b.is_active !== false));
      if (r.data.length > 0) setSelectedBranch(r.data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (fulfillment === 'delivery' && subtotal > 0) {
      apiClient.post('/shipping-methods/calculate', { subtotal }).then((r) => {
        setShippingMethods(r.data);
        if (r.data.length > 0) setSelectedShipping(r.data[0].id);
      }).catch(() => {});
    }
  }, [fulfillment, subtotal]);

  const handleSubmit = async () => {
    if (!token || !customer) {
      alert('Debes iniciar sesión para realizar un pedido.');
      return;
    }
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const body: any = {
        fulfillment_type: fulfillment,
        items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      };

      if (fulfillment === 'bopis') {
        body.pickup_branch_id = selectedBranch;
      } else {
        body.shipping_address = address;
        body.shipping_method_id = selectedShipping;
      }

      const { data } = await apiClient.post('/mobile/orders', body);
      clear();
      router.push(`/orders/${data.id}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al crear el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Link href="/"><h1 className="text-2xl font-bold text-primary">Mi Zapatería</h1></Link>
          </div>
        </header>
        <main className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Tu carrito está vacío.</p>
          <Link href="/products"><Button variant="link" className="mt-2">Explorar catálogo</Button></Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/"><h1 className="text-2xl font-bold text-primary">Mi Zapatería</h1></Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h2 className="text-3xl font-bold mb-8">Checkout</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            {/* Fulfillment selector */}
            <Card>
              <CardHeader><CardTitle>Método de entrega</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <button
                  className={`w-full border rounded-lg p-4 text-left transition-colors ${fulfillment === 'bopis' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                  onClick={() => setFulfillment('bopis')}
                >
                  <div className="flex items-center gap-3">
                    <Store className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Click & Collect</p>
                      <p className="text-sm text-muted-foreground">Recoge en tienda - Gratis</p>
                    </div>
                  </div>
                </button>
                <button
                  className={`w-full border rounded-lg p-4 text-left transition-colors ${fulfillment === 'delivery' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                  onClick={() => setFulfillment('delivery')}
                >
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Envío a domicilio</p>
                      <p className="text-sm text-muted-foreground">Costo según ubicación</p>
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>

            {/* BOPIS: Branch selector */}
            {fulfillment === 'bopis' && (
              <Card>
                <CardHeader><CardTitle>Sucursal de recolección</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      className={`w-full border rounded-lg p-3 text-left transition-colors ${selectedBranch === b.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                      onClick={() => setSelectedBranch(b.id)}
                    >
                      <p className="font-medium">{b.name}</p>
                      <p className="text-sm text-muted-foreground">{b.address}</p>
                    </button>
                  ))}
                  {branches.length === 0 && (
                    <p className="text-sm text-muted-foreground">Cargando sucursales...</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Delivery: Address + Shipping */}
            {fulfillment === 'delivery' && (
              <>
                <Card>
                  <CardHeader><CardTitle>Dirección de envío</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label>Calle y número</Label>
                      <Input value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} placeholder="Av. Insurgentes Sur 123" />
                    </div>
                    <div className="space-y-1">
                      <Label>Colonia</Label>
                      <Input value={address.neighborhood} onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })} placeholder="Roma Norte" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Ciudad</Label>
                        <Input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="CDMX" />
                      </div>
                      <div className="space-y-1">
                        <Label>Estado</Label>
                        <Input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="Ciudad de México" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Código Postal</Label>
                        <Input value={address.zip_code} onChange={(e) => setAddress({ ...address, zip_code: e.target.value })} placeholder="06700" />
                      </div>
                      <div className="space-y-1">
                        <Label>País</Label>
                        <Input value={address.country} disabled />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Referencia de entrega</Label>
                      <Input value={address.reference} onChange={(e) => setAddress({ ...address, reference: e.target.value })} placeholder="Portón negro, tocar timbre" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Método de envío</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {shippingMethods.map((m) => (
                      <button
                        key={m.id}
                        className={`w-full border rounded-lg p-3 text-left transition-colors ${selectedShipping === m.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                        onClick={() => setSelectedShipping(m.id)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{m.name}</p>
                            {m.estimated_days_min != null && (
                              <p className="text-sm text-muted-foreground">
                                {m.estimated_days_min}-{m.estimated_days_max} días hábiles
                              </p>
                            )}
                          </div>
                          <p className="font-semibold">
                            {m.cost === 0 ? 'Gratis' : `$${m.cost.toFixed(2)}`}
                          </p>
                        </div>
                      </button>
                    ))}
                    {shippingMethods.length === 0 && (
                      <p className="text-sm text-muted-foreground">Cargando opciones de envío...</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Order summary */}
          <Card className="h-fit sticky top-8">
            <CardHeader><CardTitle>Resumen del pedido</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.variant_id} className="flex justify-between text-sm">
                  <span className="truncate mr-2">{item.product_name} x{item.quantity}</span>
                  <span className="shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Envío</span>
                <span>{shippingCost === 0 ? 'Gratis' : `$${shippingCost.toFixed(2)}`}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
                ) : (
                  'Confirmar pedido'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
