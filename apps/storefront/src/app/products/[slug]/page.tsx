import { Button, Badge } from '@nivo/ui';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProductDetailPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <h1 className="text-2xl font-bold text-primary">Mi Zapatería</h1>
          </Link>
          <Link href="/cart">
            <Button variant="outline" size="sm" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Carrito
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Link href="/products" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Imagen del producto</p>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <Badge variant="secondary">Categoría</Badge>
              <h1 className="text-3xl font-bold mt-2">Producto: {params.slug}</h1>
              <p className="text-2xl font-semibold text-primary mt-2">$0.00</p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Color</p>
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-black border-2 border-primary cursor-pointer" />
                  <div className="w-8 h-8 rounded-full bg-amber-800 border cursor-pointer" />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Talla (MX)</p>
                <div className="flex gap-2 flex-wrap">
                  {[24, 25, 26, 27, 28].map((size) => (
                    <Button key={size} variant="outline" size="sm">
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Button size="lg" className="w-full gap-2">
              <ShoppingCart className="h-5 w-5" />
              Agregar al carrito
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
