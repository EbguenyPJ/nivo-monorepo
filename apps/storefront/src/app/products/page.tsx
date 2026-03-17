import { Card, CardContent, Badge, Button } from '@nivo/ui';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export default function ProductsPage() {
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
        <h2 className="text-3xl font-bold mb-8">Catálogo</h2>

        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">El catálogo se cargará desde la API del tenant.</p>
          <p className="text-sm mt-2">Conecta la tienda con tu inventario para mostrar productos.</p>
        </div>
      </main>
    </div>
  );
}
