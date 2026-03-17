'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Separator } from '@nivo/ui';
import { useAuthStore } from '@/store/authStore';

export default function SettingsPage() {
  const tenant = useAuthStore((s) => s.tenant);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
        <p className="text-muted-foreground">Personaliza tu zapatería</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="account">Cuenta</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Tienda</CardTitle>
              <CardDescription>
                Datos generales de tu zapatería.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre de la tienda</Label>
                <Input value={tenant?.name || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Subdominio</Label>
                <div className="flex items-center gap-2">
                  <Input value={tenant?.subdomain || ''} disabled className="bg-muted" />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.nivo.app</span>
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Estado</h4>
                <Badge variant="default">Activa</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Marca y Personalización</CardTitle>
              <CardDescription>
                Configura el logo y colores de tu marca para el POS y tienda en línea.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo">Logo URL</Label>
                <Input id="logo" placeholder="https://ejemplo.com/logo.png" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primary-color">Color primario</Label>
                <Input id="primary-color" type="color" defaultValue="#3b82f6" className="h-10 w-20" />
              </div>
              <p className="text-xs text-muted-foreground">
                La personalización de marca estará disponible próximamente.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Mi Cuenta</CardTitle>
              <CardDescription>Información de tu cuenta de usuario.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={user?.name || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input value={user?.email || ''} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <div>
                  <Badge variant="secondary">{user?.role || 'employee'}</Badge>
                </div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Para cambiar tu contraseña o datos de cuenta, contacta al administrador.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
