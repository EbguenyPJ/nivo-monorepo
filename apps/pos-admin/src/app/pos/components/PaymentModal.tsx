'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Input } from '@nivo/ui';
import { X, Banknote, CreditCard, Loader2 } from 'lucide-react';

type PaymentMethod = 'cash' | 'card' | 'mixed';

interface PaymentModalProps {
  open: boolean;
  total: number;
  processingPayment: boolean;
  onConfirm: (method: PaymentMethod, amountReceived?: number) => void;
  onClose: () => void;
}

export function PaymentModal({ open, total, processingPayment, onConfirm, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const cashInputRef = useRef<HTMLInputElement>(null);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setMethod(null);
      setCashReceived('');
    }
  }, [open]);

  // Focus cash input when selecting cash
  useEffect(() => {
    if (method === 'cash' && cashInputRef.current) {
      setTimeout(() => cashInputRef.current?.focus(), 100);
    }
  }, [method]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processingPayment) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, processingPayment, onClose]);

  if (!open) return null;

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - total;
  const canConfirmCash = cashAmount >= total;

  const handleConfirm = () => {
    if (!method) return;
    if (method === 'cash') {
      onConfirm('cash', cashAmount);
    } else {
      onConfirm(method);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-sm"
        onClick={!processingPayment ? onClose : undefined}
      />

      <div className="relative z-10 w-full max-w-lg mx-4">
        <div className="rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-xl font-bold">Cobrar</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={processingPayment}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Total */}
          <div className="p-5 text-center border-b bg-[#0a0a0a]">
            <p className="text-xs text-[#39FF14]/60 font-mono uppercase tracking-wider mb-1">Total a cobrar</p>
            <p
              className="text-4xl font-bold font-mono text-[#39FF14] tabular-nums"
              style={{ textShadow: '0 0 10px rgba(57, 255, 20, 0.5)' }}
            >
              ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Method selection */}
          {!method && (
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Selecciona metodo de pago
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('cash')}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl border bg-card hover:bg-accent hover:border-primary transition-all active:scale-95"
                >
                  <Banknote className="h-8 w-8 text-green-600" />
                  <span className="font-semibold">Efectivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('card')}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl border bg-card hover:bg-accent hover:border-primary transition-all active:scale-95"
                >
                  <CreditCard className="h-8 w-8 text-blue-600" />
                  <span className="font-semibold">Tarjeta</span>
                </button>
              </div>
            </div>
          )}

          {/* Cash flow */}
          {method === 'cash' && (
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto recibido</label>
                <Input
                  ref={cashInputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canConfirmCash) handleConfirm();
                  }}
                  className="text-2xl h-14 text-center font-mono"
                />
              </div>

              {/* Quick amount buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500]
                  .filter((v, i, arr) => arr.indexOf(v) === i && v >= total)
                  .slice(0, 4)
                  .map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      className="text-xs font-mono"
                      onClick={() => setCashReceived(amount.toString())}
                    >
                      ${amount.toLocaleString('es-MX')}
                    </Button>
                  ))}
              </div>

              {cashAmount > 0 && (
                <div className={`text-center p-3 rounded-lg ${
                  canConfirmCash ? 'bg-green-500/10' : 'bg-destructive/10'
                }`}>
                  <p className="text-xs text-muted-foreground mb-0.5">Cambio</p>
                  <p className={`text-2xl font-bold font-mono tabular-nums ${
                    canConfirmCash ? 'text-green-600' : 'text-destructive'
                  }`}>
                    ${Math.max(0, change).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMethod(null)}
                  disabled={processingPayment}
                >
                  Atras
                </Button>
                <Button
                  className="flex-1 h-12 text-base font-bold"
                  disabled={!canConfirmCash || processingPayment}
                  onClick={handleConfirm}
                >
                  {processingPayment ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Card flow */}
          {method === 'card' && (
            <div className="p-5 space-y-4">
              <div className="text-center p-6">
                <CreditCard className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                <p className="text-sm text-muted-foreground">
                  Confirma el pago con tarjeta
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMethod(null)}
                  disabled={processingPayment}
                >
                  Atras
                </Button>
                <Button
                  className="flex-1 h-12 text-base font-bold"
                  disabled={processingPayment}
                  onClick={handleConfirm}
                >
                  {processingPayment ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Confirmar Pago'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
