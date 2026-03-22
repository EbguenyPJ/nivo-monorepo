'use client';

import { Card, CardContent } from '@nivo/ui';
import { Calculator } from 'lucide-react';

export default function CashRegisterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Arqueos y Cortes de Caja</h2>
        <p className="text-sm text-muted-foreground mt-1">Gestiona tus arqueos y cortes de caja</p>
      </div>
      <Card className="bg-card border-border">
        <CardContent className="p-12 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Próximamente</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Este módulo está en desarrollo. Pronto podrás gestionar tus arqueos y cortes de caja desde aquí.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
