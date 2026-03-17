'use client';

import {
  Button, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@nivo/ui';
import { CheckCircle } from 'lucide-react';

interface SaleConfirmationProps {
  open: boolean;
  onClose: () => void;
  sale: {
    id: string;
    total: number;
    paymentMethod: string;
    itemCount: number;
  } | null;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
};

export function SaleConfirmation({ open, onClose, sale }: SaleConfirmationProps) {
  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl">Venta Registrada</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-bold">${sale.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Método</span>
            <Badge variant="secondary">{PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Productos</span>
            <span className="text-sm font-medium">{sale.itemCount} artículos</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">ID</span>
            <span className="text-xs font-mono text-muted-foreground">{sale.id.slice(0, 8)}...</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            Nueva Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
