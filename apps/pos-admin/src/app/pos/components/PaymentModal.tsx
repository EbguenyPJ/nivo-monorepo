'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input } from '@nivo/ui';
import { X, Banknote, CreditCard, Building2, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────

interface PaymentMethodInfo {
  id: string;
  name: string;
  requires_reference: boolean;
  is_active: boolean;
}

export interface PaymentEntry {
  payment_method_id: string;
  payment_method_name: string;
  amount: number;          // Effective amount applied to sale
  tendered?: number;       // For cash: actual amount customer handed over (may be > amount)
  reference: string | null;
}

interface PaymentModalProps {
  open: boolean;
  total: number;
  processingPayment: boolean;
  onConfirm: (payments: PaymentEntry[]) => void;
  onClose: () => void;
}

// ─── Icon for payment method ─────────────────────────────────────

function PaymentIcon({ name, className }: { name: string; className?: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('efectivo')) return <Banknote className={className} />;
  if (lower.includes('tarjeta')) return <CreditCard className={className} />;
  if (lower.includes('transferencia')) return <Building2 className={className} />;
  return <Banknote className={className} />;
}

// ─── Smart bill denominations ────────────────────────────────────

function getSmartBills(amount: number): number[] {
  const bills = new Set<number>();
  bills.add(amount); // Exact amount
  const denoms = [20, 50, 100, 200, 500, 1000];
  for (const d of denoms) {
    const rounded = Math.ceil(amount / d) * d;
    if (rounded >= amount) bills.add(rounded);
  }
  return Array.from(bills)
    .filter((v) => v >= amount)
    .sort((a, b) => a - b)
    .slice(0, 5);
}

// ─── Main Component ──────────────────────────────────────────────

export function PaymentModal({ open, total, processingPayment, onConfirm, onClose }: PaymentModalProps) {
  const [methods, setMethods] = useState<PaymentMethodInfo[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  // Current capture state
  const [activeMethod, setActiveMethod] = useState<PaymentMethodInfo | null>(null);
  const [captureAmount, setCaptureAmount] = useState('');
  const [captureReference, setCaptureReference] = useState('');

  const amountInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  // ─── Derived values ─────────────────────────────────────────
  const paidSoFar = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, parseFloat((total - paidSoFar).toFixed(2)));
  const isFullyPaid = remaining <= 0.005; // floating point tolerance

  const isCash = activeMethod?.name?.toLowerCase().includes('efectivo') ?? false;
  const captureAmountNum = parseFloat(captureAmount) || 0;

  // For non-cash: cannot exceed remaining
  const maxAllowed = isCash ? Infinity : remaining;
  const canAddPayment = captureAmountNum > 0 && captureAmountNum <= maxAllowed &&
    (!activeMethod?.requires_reference || captureReference.trim().length > 0);

  // Cash change calculation
  const cashChange = isCash ? Math.max(0, captureAmountNum - remaining) : 0;
  const effectiveCashAmount = isCash ? Math.min(captureAmountNum, remaining) : captureAmountNum;

  // ─── Load payment methods ───────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setPayments([]);
    setActiveMethod(null);
    setCaptureAmount('');
    setCaptureReference('');

    const fetchMethods = async () => {
      setLoadingMethods(true);
      try {
        const res = await apiClient.get('/pos/payment-methods');
        setMethods(res.data || []);
      } catch {
        setMethods([]);
      } finally {
        setLoadingMethods(false);
      }
    };
    fetchMethods();
  }, [open]);

  // ─── Auto-focus amount input ────────────────────────────────
  useEffect(() => {
    if (activeMethod && amountInputRef.current) {
      setTimeout(() => amountInputRef.current?.focus(), 100);
    }
  }, [activeMethod]);

  // ─── F-key shortcuts ────────────────────────────────────────
  useEffect(() => {
    if (!open || activeMethod) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processingPayment) {
        onClose();
        return;
      }
      const fKeyMatch = e.key.match(/^F(\d+)$/);
      if (fKeyMatch) {
        const idx = parseInt(fKeyMatch[1]) - 1;
        if (idx >= 0 && idx < methods.length) {
          e.preventDefault();
          selectMethod(methods[idx]);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, activeMethod, methods, processingPayment, onClose]);

  // Escape from capture
  useEffect(() => {
    if (!open || !activeMethod) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveMethod(null);
        setCaptureAmount('');
        setCaptureReference('');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, activeMethod]);

  // ─── Handlers ───────────────────────────────────────────────

  const selectMethod = useCallback((method: PaymentMethodInfo) => {
    setActiveMethod(method);
    // Pre-fill with remaining for convenience
    setCaptureAmount(remaining.toFixed(2));
    setCaptureReference('');
  }, [remaining]);

  const addPayment = useCallback(() => {
    if (!activeMethod || !canAddPayment) return;
    const entry: PaymentEntry = {
      payment_method_id: activeMethod.id,
      payment_method_name: activeMethod.name,
      amount: parseFloat(effectiveCashAmount.toFixed(2)),
      tendered: isCash && captureAmountNum > effectiveCashAmount
        ? parseFloat(captureAmountNum.toFixed(2))
        : undefined,
      reference: captureReference.trim() || null,
    };
    setPayments((prev) => [...prev, entry]);
    setActiveMethod(null);
    setCaptureAmount('');
    setCaptureReference('');
  }, [activeMethod, canAddPayment, effectiveCashAmount, captureAmountNum, isCash, captureReference]);

  const removePayment = useCallback((index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirmSale = useCallback(() => {
    if (!isFullyPaid || processingPayment) return;
    onConfirm(payments);
  }, [isFullyPaid, processingPayment, payments, onConfirm]);

  const handleCaptureKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canAddPayment) {
      if (activeMethod?.requires_reference && !captureReference.trim()) {
        referenceInputRef.current?.focus();
      } else {
        addPayment();
      }
    }
  }, [canAddPayment, addPayment, activeMethod, captureReference]);

  if (!open) return null;

  const smartBills = isCash ? getSmartBills(remaining) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
        onClick={!processingPayment ? onClose : undefined}
      />

      <div className="relative z-10 w-full max-w-3xl">
        <div className="rounded-2xl bg-slate-900/95 border border-slate-700/40 shadow-2xl shadow-black/50 backdrop-blur-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
            <h2 className="text-lg font-bold text-white">Cobrar Venta</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={processingPayment}
              className="p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Two-column layout */}
          <div className="flex min-h-[400px]">
            {/* ═══ LEFT COLUMN (30%) — Financial Summary ═══ */}
            <div className="w-[35%] border-r border-slate-800/60 flex flex-col">
              {/* Total */}
              <div className="p-4 text-center border-b border-slate-800/60 bg-black">
                <p className="text-[10px] text-[#39FF14]/50 font-mono uppercase tracking-widest mb-1">Total</p>
                <p
                  className="text-3xl font-bold font-mono text-[#39FF14] tabular-nums"
                  style={{ textShadow: '0 0 12px rgba(57, 255, 20, 0.6), 0 0 30px rgba(57, 255, 20, 0.2)' }}
                >
                  ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Payment entries */}
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {payments.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center mt-4">Sin pagos registrados</p>
                ) : (
                  payments.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/20"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <PaymentIcon name={p.payment_method_name} className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate">{p.payment_method_name}</p>
                          {p.reference && (
                            <p className="text-[10px] text-slate-500 truncate">Ref: {p.reference}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-sm font-semibold text-white font-mono tabular-nums">
                          ${p.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          onClick={() => removePayment(i)}
                          disabled={processingPayment}
                          className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Remaining / Paid tally */}
              <div className="border-t border-slate-800/60 p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Pagado</span>
                  <span className="text-slate-300 font-mono tabular-nums">
                    ${paidSoFar.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className={isFullyPaid ? 'text-emerald-400' : 'text-amber-400'}>
                    {isFullyPaid ? 'Pagado completo' : 'Restante'}
                  </span>
                  <span className={`font-mono tabular-nums ${isFullyPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isFullyPaid
                      ? <CheckCircle2 className="h-4 w-4 inline" />
                      : `$${remaining.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* ═══ RIGHT COLUMN (70%) — Payment Capture ═══ */}
            <div className="flex-1 flex flex-col">
              {loadingMethods ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
              ) : !activeMethod ? (
                /* ─── Method Selection ─── */
                <div className="flex-1 flex flex-col">
                  <div className="p-4 flex-1">
                    {isFullyPaid ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
                        <p className="text-lg font-semibold text-white mb-1">Pago completo</p>
                        <p className="text-sm text-slate-400">Confirma la venta para finalizar</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 text-center mb-4">
                          Selecciona metodo de pago
                          {remaining < total && (
                            <span className="text-amber-400 ml-1">
                              (faltan ${remaining.toLocaleString('es-MX', { minimumFractionDigits: 2 })})
                            </span>
                          )}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {methods.map((m, idx) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => selectMethod(m)}
                              className="flex flex-col items-center gap-2 p-5 rounded-xl bg-slate-800/50 border border-slate-700/30 hover:bg-slate-700/60 hover:border-slate-600/50 transition-all active:scale-95 group"
                            >
                              <PaymentIcon
                                name={m.name}
                                className="h-7 w-7 text-slate-400 group-hover:text-white transition-colors"
                              />
                              <span className="font-medium text-sm text-slate-300 group-hover:text-white transition-colors">
                                {m.name}
                              </span>
                              <span className="text-[10px] text-slate-600 font-mono">F{idx + 1}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Confirm sale button */}
                  <div className="p-4 border-t border-slate-800/60">
                    <Button
                      className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
                      disabled={!isFullyPaid || processingPayment}
                      onClick={handleConfirmSale}
                    >
                      {processingPayment ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        'Confirmar Venta'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* ─── Amount Capture ─── */
                <div className="flex-1 flex flex-col p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                      onClick={() => { setActiveMethod(null); setCaptureAmount(''); setCaptureReference(''); }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2">
                      <PaymentIcon name={activeMethod.name} className="h-5 w-5 text-cyan-400" />
                      <span className="text-base font-semibold text-white">{activeMethod.name}</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    {/* Amount input */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Monto</label>
                      <Input
                        ref={amountInputRef}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={captureAmount}
                        onChange={(e) => setCaptureAmount(e.target.value)}
                        onKeyDown={handleCaptureKeyDown}
                        className="text-2xl h-14 text-center font-mono bg-slate-800/50 border-slate-700/50 text-white focus:border-cyan-500/50"
                      />
                      {!isCash && captureAmountNum > remaining && (
                        <p className="text-[10px] text-red-400 text-center">
                          No puede exceder el restante (${remaining.toLocaleString('es-MX', { minimumFractionDigits: 2 })})
                        </p>
                      )}
                    </div>

                    {/* Smart bill buttons (cash only) */}
                    {isCash && smartBills.length > 0 && (
                      <div className="grid grid-cols-5 gap-2">
                        {smartBills.map((amount) => (
                          <button
                            key={amount}
                            className={`text-xs font-mono py-2 px-1 rounded-lg border transition-all ${
                              parseFloat(captureAmount) === amount
                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                                : 'bg-slate-800/50 border-slate-700/30 text-slate-300 hover:bg-slate-700 hover:text-white'
                            }`}
                            onClick={() => setCaptureAmount(amount.toString())}
                          >
                            ${amount.toLocaleString('es-MX')}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Cash change display */}
                    {isCash && captureAmountNum > 0 && (
                      <div className={`text-center p-3 rounded-xl ${
                        captureAmountNum >= remaining
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : 'bg-slate-800/50 border border-slate-700/20'
                      }`}>
                        <p className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wider">Cambio</p>
                        <p className={`text-2xl font-bold font-mono tabular-nums ${
                          cashChange > 0 ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          ${cashChange.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}

                    {/* Reference field (for cards / transfers) */}
                    {activeMethod.requires_reference && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Referencia</label>
                        <Input
                          ref={referenceInputRef}
                          placeholder="Numero de referencia, ultimos 4 digitos..."
                          value={captureReference}
                          onChange={(e) => setCaptureReference(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && canAddPayment) addPayment(); }}
                          className="h-10 bg-slate-800/50 border-slate-700/50 text-white focus:border-cyan-500/50 placeholder:text-slate-600"
                        />
                      </div>
                    )}
                  </div>

                  {/* Add payment button */}
                  <div className="flex gap-2 pt-4 mt-auto">
                    <button
                      className="flex-1 py-3 rounded-xl bg-slate-800/50 border border-slate-700/30 text-slate-300 hover:bg-slate-700 transition-all text-sm font-medium"
                      onClick={() => { setActiveMethod(null); setCaptureAmount(''); setCaptureReference(''); }}
                    >
                      Cancelar
                    </button>
                    <Button
                      className="flex-1 h-12 text-base font-bold bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-500/20"
                      disabled={!canAddPayment}
                      onClick={addPayment}
                    >
                      Agregar Pago
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
