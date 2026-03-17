'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label } from '@nivo/ui';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-muted-foreground">Personaliza tu zapatería</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marca y Personalización</CardTitle>
          <CardDescription>
            Configura el logo y colores de tu marca para el POS y tienda en línea.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-name">Nombre de la tienda</Label>
            <Input id="store-name" placeholder="Mi Zapatería" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL</Label>
            <Input id="logo" placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primary-color">Color primario</Label>
            <Input id="primary-color" type="color" defaultValue="#3b82f6" className="h-10 w-20" />
          </div>
          <Button>Guardar cambios</Button>
        </CardContent>
      </Card>
    </div>
  );
}
