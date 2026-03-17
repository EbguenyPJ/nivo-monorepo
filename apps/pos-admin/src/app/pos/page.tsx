'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Badge, Separator } from '@nivo/ui';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface CartItem {
  id: string;
  name: string;
  variant: string;
  price: number;
  quantity: number;
}

export default function PosPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  return (
    <div className="flex h-screen">
      {/* Product Grid */}
      <div className="flex-1 flex flex-col p-4">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Escanear código de barras o buscar producto..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            Turno: Abierto
          </Badge>
        </div>

        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-auto">
          <div className="col-span-full flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg">Escanea un código de barras</p>
              <p className="text-sm">o busca un producto para comenzar</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 border-l bg-card flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Carrito de Venta</h3>
          <p className="text-sm text-muted-foreground">{cart.length} productos</p>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">El carrito está vacío</p>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.variant}</p>
                  <p className="text-sm font-semibold">${item.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => updateQuantity(item.id, -item.quantity)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t p-4 space-y-3">
          <Separator />
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-2" disabled={cart.length === 0}>
              <Banknote className="h-4 w-4" />
              Efectivo
            </Button>
            <Button className="gap-2" disabled={cart.length === 0}>
              <CreditCard className="h-4 w-4" />
              Tarjeta
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
