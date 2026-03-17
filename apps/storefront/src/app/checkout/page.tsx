'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Separator } from '@nivo/ui';
import Link from 'next/link';

export default function CheckoutPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <h1 className="text-2xl font-bold text-primary">Mi Zapatería</h1>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h2 className="text-3xl font-bold mb-8">Checkout</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información de contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input placeholder="Juan Pérez" />
                </div>
                <div className="space-y-2">
                  <Label>Correo electrónico</Label>
                  <Input type="email" placeholder="juan@email.com" />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input type="tel" placeholder="+52 ..." />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Método de entrega</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border rounded-lg p-4 cursor-pointer hover:border-primary">
                  <p className="font-medium">Click & Collect</p>
                  <p className="text-sm text-muted-foreground">Recoge en tienda - Gratis</p>
                </div>
                <div className="border rounded-lg p-4 cursor-pointer hover:border-primary">
                  <p className="font-medium">Envío a domicilio</p>
                  <p className="text-sm text-muted-foreground">Cálculo al ingresar dirección</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumen del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">No hay productos en el carrito.</p>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>$0.00</span>
              </div>
              <Button className="w-full" size="lg" disabled>
                Confirmar pedido
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
