import Link from 'next/link';
import { Button, Card, CardContent } from '@nivo/ui';
import { ShoppingBag, Truck, MapPin } from 'lucide-react';

export default function StorefrontHome() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Mi Zapatería</h1>
          <nav className="flex items-center gap-6">
            <Link href="/products" className="text-sm text-muted-foreground hover:text-foreground">
              Catálogo
            </Link>
            <Link href="/cart">
              <Button variant="outline" size="sm" className="gap-2">
                <ShoppingBag className="h-4 w-4" />
                Carrito (0)
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold tracking-tight mb-6">
          Los mejores zapatos,<br />a tu alcance
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Encuentra el par perfecto. Compra en línea y recoge en tienda o recíbelo en tu puerta.
        </p>
        <Link href="/products">
          <Button size="lg" className="text-lg px-8">
            Ver catálogo
          </Button>
        </Link>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold text-lg mb-2">Compra en línea</h3>
              <p className="text-sm text-muted-foreground">
                Explora nuestro catálogo completo con tallas y colores disponibles en tiempo real.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold text-lg mb-2">Click & Collect</h3>
              <p className="text-sm text-muted-foreground">
                Reserva tu par y recógelo en la sucursal más cercana sin costo de envío.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Truck className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold text-lg mb-2">Envío a domicilio</h3>
              <p className="text-sm text-muted-foreground">
                Recibe tus zapatos en la puerta de tu casa con seguimiento en tiempo real.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>Powered by <span className="font-semibold text-primary">Nivo</span></p>
        </div>
      </footer>
    </div>
  );
}
