'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input } from '@nivo/ui';
import { X, Banknote, CreditCard, Building2, Loader2, Trash2, CheckCircle2, Sparkles } from 'lucide-react';
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

const money = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2 });

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
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={!processingPayment ? onClose : undefined}
      />

      <div className="relative z-10 w-full max-w-md">
        <div
          className="rounded-3xl bg-slate-950/60 border border-white/10 shadow-2xl shadow-black/60 backdrop-blur-2xl overflow-hidden max-h-[92vh] flex flex-col"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 25px 50px -12px rgba(0,0,0,0.6)' }}
        >
          {/* ─── Header: CHECKOUT ─── */}
          <div className="relative pt-5 pb-1">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-white/40">
              Checkout
            </p>
            <button
              type="button"
              onClick={onClose}
              disabled={processingPayment}
              className="absolute right-4 top-4 p-1.5 text-white/40 hover:text-white transition-colors disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-5">
            {/* ─── Hero number ─── */}
            <div className="text-center py-4">
              <p
                className="text-5xl font-bold font-mono tabular-nums text-emerald-400"
                style={{ textShadow: '0 0 18px rgba(52, 211, 153, 0.55), 0 0 45px rgba(52, 211, 153, 0.2)' }}
              >
                ${money(total)}
              </p>
              {!isFullyPaid && paidSoFar > 0 && (
                <p className="mt-2 text-sm font-mono text-amber-400">
                  Restante: <span className="font-semibold">${money(remaining)}</span>
                </p>
              )}
              {isFullyPaid && (
                <p className="mt-2 text-sm font-mono text-emerald-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Pagado completo
                </p>
              )}
            </div>

            {loadingMethods ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-white/40" />
              </div>
            ) : !activeMethod ? (
              /* ─── Method grid (segmented, one row) ─── */
              <div className="grid grid-cols-4 gap-2">
                {methods.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMethod(m)}
                    disabled={isFullyPaid}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3.5 transition-all hover:bg-white/[0.09] hover:border-white/20 active:scale-95 disabled:opacity-35 disabled:pointer-events-none group"
                  >
                    <PaymentIcon name={m.name} className="h-5 w-5 text-white/50 group-hover:text-white transition-colors" />
                    <span className="w-full truncate text-center text-[11px] font-medium text-white/70 group-hover:text-white transition-colors">
                      {m.name}
                    </span>
                    <span className="text-[9px] font-mono text-white/30">F{idx + 1}</span>
                  </button>
                ))}
              </div>
            ) : (
              /* ─── Amount capture (in place of grid) ─── */
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="mb-4 flex items-center gap-3">
                  <button
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                    onClick={() => { setActiveMethod(null); setCaptureAmount(''); setCaptureReference(''); }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <PaymentIcon name={activeMethod.name} className="h-5 w-5 text-emerald-400" />
                    <span className="text-base font-semibold text-white">{activeMethod.name}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Amount input */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-white/40">Monto</label>
                    <Input
                      ref={amountInputRef}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={captureAmount}
                      onChange={(e) => setCaptureAmount(e.target.value)}
                      onKeyDown={handleCaptureKeyDown}
                      className="text-2xl h-14 text-center font-mono bg-black/30 border-white/10 text-white focus:border-emerald-500/50"
                    />
                    {!isCash && captureAmountNum > remaining && (
                      <p className="text-[10px] text-red-400 text-center">
                        No puede exceder el restante (${money(remaining)})
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
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
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
                    <div className={`text-center p-3 rounded-xl border ${
                      captureAmountNum >= remaining
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-white/[0.04] border-white/10'
                    }`}>
                      <p className="text-[10px] text-white/40 mb-0.5 uppercase tracking-wider">Cambio</p>
                      <p className={`text-2xl font-bold font-mono tabular-nums ${
                        cashChange > 0 ? 'text-emerald-400' : 'text-white/40'
                      }`}>
                        ${money(cashChange)}
                      </p>
                    </div>
                  )}

                  {/* Reference field (for cards / transfers) */}
                  {activeMethod.requires_reference && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-white/40">Referencia</label>
                      <Input
                        ref={referenceInputRef}
                        placeholder="Numero de referencia, ultimos 4 digitos..."
                        value={captureReference}
                        onChange={(e) => setCaptureReference(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && canAddPayment) addPayment(); }}
                        className="h-10 bg-black/30 border-white/10 text-white focus:border-emerald-500/50 placeholder:text-white/25"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all text-sm font-medium"
                      onClick={() => { setActiveMethod(null); setCaptureAmount(''); setCaptureReference(''); }}
                    >
                      Cancelar
                    </button>
                    <Button
                      className="flex-1 h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                      disabled={!canAddPayment}
                      onClick={addPayment}
                    >
                      Agregar Pago
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Registered payments ─── */}
            {payments.length > 0 && (
              <div className="mt-4 space-y-2">
                {payments.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PaymentIcon name={p.payment_method_name} className="h-4 w-4 text-white/50 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.payment_method_name}</p>
                        {p.reference && (
                          <p className="text-xs font-mono text-white/40 truncate">Ref: {p.reference}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-white font-mono tabular-nums">
                        ${money(p.amount)}
                      </span>
                      <button
                        onClick={() => removePayment(i)}
                        disabled={processingPayment}
                        className="p-1 rounded text-white/30 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ─── Receipt-style breakdown ─── */}
            <div className="mt-5 border-t border-dashed border-white/20 pt-3 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">Subtotal</span>
                <span className="text-white/70 tabular-nums">${money(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Pagado</span>
                <span className="text-white/70 tabular-nums">${money(paidSoFar)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className={isFullyPaid ? 'text-emerald-400' : 'text-amber-400'}>Restante</span>
                <span className={`tabular-nums ${isFullyPaid ? 'text-emerald-400' : 'text-amber-400'}`}>
                  ${money(remaining)}
                </span>
              </div>
            </div>

            {/* ─── CTA: Cobrar $X ─── */}
            <button
              type="button"
              disabled={!isFullyPaid || processingPayment}
              onClick={handleConfirmSale}
              className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-white transition-all
                bg-gradient-to-b from-emerald-500 to-emerald-700
                shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 hover:from-emerald-400 hover:to-emerald-600
                focus:outline-none focus:ring-2 focus:ring-emerald-400/60 active:scale-[0.99]
                disabled:from-white/[0.06] disabled:to-white/[0.06] disabled:text-white/30 disabled:shadow-none disabled:pointer-events-none"
            >
              {processingPayment ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Cobrar ${money(total)}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
