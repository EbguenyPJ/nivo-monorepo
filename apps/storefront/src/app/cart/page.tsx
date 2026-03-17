import { Button, Card, CardContent, CardHeader, CardTitle, Separator } from '@nivo/ui';
import { ArrowLeft, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function CartPage() {
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
        <Link href="/products" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Seguir comprando
        </Link>

        <h2 className="text-3xl font-bold mb-8">Tu Carrito</h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>Tu carrito está vacío</p>
                <Link href="/products">
                  <Button variant="link" className="mt-2">Explorar catálogo</Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Envío</span>
                <span className="text-muted-foreground">Por calcular</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>$0.00</span>
              </div>
              <Button className="w-full gap-2" disabled>
                <CreditCard className="h-4 w-4" />
                Proceder al pago
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
