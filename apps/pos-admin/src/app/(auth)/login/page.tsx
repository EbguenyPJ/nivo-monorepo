'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Label } from '@nivo/ui';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenant, setTenant] = useState('');
  const [isEmployeeLogin, setIsEmployeeLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(email, password, isEmployeeLogin ? tenant : undefined);
      // Small delay to ensure Zustand persists to localStorage
      await new Promise((resolve) => setTimeout(resolve, 100));
      const state = useAuthStore.getState();
      if (state.userType === 'super-admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">Nivo</CardTitle>
          <CardDescription>Inicia sesión en tu punto de venta</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@zapateria.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {isEmployeeLogin && (
              <div className="space-y-2">
                <Label htmlFor="tenant">Subdominio de tu zapatería</Label>
                <Input
                  id="tenant"
                  type="text"
                  placeholder="mizapateria"
                  value={tenant}
                  onChange={(e) => setTenant(e.target.value)}
                  required
                />
              </div>
            )}

            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-primary underline"
              onClick={() => setIsEmployeeLogin(!isEmployeeLogin)}
            >
              {isEmployeeLogin ? '← Soy Super Admin' : 'Soy empleado de una zapatería →'}
            </button>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
