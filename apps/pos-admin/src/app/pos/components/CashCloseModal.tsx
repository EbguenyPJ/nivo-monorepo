'use client';

import { useState, useEffect } from 'react';
import { Button, Input } from '@nivo/ui';
import { Lock, Loader2, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Printer, ShoppingBag } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface SessionSummary {
  session_id: string;
  employee_name: string;
  cash_register_name: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  opening_amount: number;
  total_cash_sales: number;
  total_cash_in: number;
  total_cash_out: number;
  total_refunds: number;
  expected_cash: number;
  declared_amount: number | null;
  difference: number | null;
  payment_methods: { method: string; total: number; count: number }[];
  total_sales_count: number;
  total_sales_amount: number;
  audits: { declared: number; expected: number; difference: number; time: string }[];
}

interface CashCloseModalProps {
  open: boolean;
  sessionId: string;
  employeeName: string;
  cashRegisterName: string;
  onClose: (summary: SessionSummary | null) => void;
  onCloseSession: (declaredAmount: number) => Promise<any>;
}

// ─── Denomination config ─────────────────────────────────────────

const MXN_DENOMINATIONS = [
  { label: '$1,000', value: 1000 },
  { label: '$500', value: 500 },
  { label: '$200', value: 200 },
  { label: '$100', value: 100 },
  { label: '$50', value: 50 },
  { label: '$20', value: 20 },
  { label: '$10', value: 10 },
  { label: '$5', value: 5 },
  { label: '$2', value: 2 },
  { label: '$1', value: 1 },
  { label: '$0.50', value: 0.50 },
];

// ─── Print close receipt ─────────────────────────────────────────

function printCloseReceipt(summary: SessionSummary) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const openTime = new Date(summary.opened_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const diff = summary.difference ?? 0;

  const methodsHTML = summary.payment_methods.map((pm) => `
    <div class="row"><span>${pm.method} (${pm.count} ops)</span><span>$${pm.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  `).join('');

  const html = `<!DOCTYPE html><html><head><title>Corte Z</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 80mm; padding: 4mm; font-size: 11px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
  .row.big { font-size: 12px; font-weight: bold; }
  .header { font-size: 14px; font-weight: bold; letter-spacing: 1px; }
  .diff-pos { color: #059669; font-weight: bold; font-size: 14px; }
  .diff-neg { color: #DC2626; font-weight: bold; font-size: 14px; }
  .diff-zero { color: #000; font-weight: bold; font-size: 14px; }
  .meta { font-size: 9px; color: #444; }
  @media print { body { width: auto; margin: 0; padding: 2mm; } @page { margin: 0; size: 80mm auto; } }
</style></head><body>
  <div class="center">
    <div class="header">CORTE Z - CIERRE DE CAJA</div>
    <div class="meta">${dateStr} ${timeStr}</div>
  </div>
  <div class="divider"></div>
  <div class="row"><span>Caja:</span><span class="bold">${summary.cash_register_name}</span></div>
  <div class="row"><span>Cajero:</span><span>${summary.employee_name}</span></div>
  <div class="row"><span>Apertura:</span><span>${openTime}</span></div>
  <div class="row"><span>Ventas:</span><span>${summary.total_sales_count} operaciones</span></div>
  <div class="divider"></div>
  <div class="center bold" style="margin:4px 0;">FLUJO DE EFECTIVO</div>
  <div class="row"><span>Fondo Inicial:</span><span>$${summary.opening_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  <div class="row"><span>+ Ventas Efectivo:</span><span>$${summary.total_cash_sales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  ${summary.total_cash_in > 0 ? `<div class="row"><span>+ Entradas:</span><span>$${summary.total_cash_in.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>` : ''}
  ${summary.total_cash_out > 0 ? `<div class="row"><span>- Retiros:</span><span>$${summary.total_cash_out.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>` : ''}
  ${summary.total_refunds > 0 ? `<div class="row"><span>- Devoluciones:</span><span>$${summary.total_refunds.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>` : ''}
  <div class="divider"></div>
  <div class="row big"><span>Esperado:</span><span>$${summary.expected_cash.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  <div class="row big"><span>Declarado:</span><span>$${(summary.declared_amount ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  <div class="divider"></div>
  <div class="center">
    <div class="${diff > 0 ? 'diff-pos' : diff < 0 ? 'diff-neg' : 'diff-zero'}">
      DIFERENCIA: ${diff > 0 ? '+' : ''}$${diff.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
      ${diff > 0 ? '(SOBRANTE)' : diff < 0 ? '(FALTANTE)' : '(CUADRA)'}
    </div>
  </div>
  ${summary.payment_methods.length > 0 ? `
    <div class="divider"></div>
    <div class="center bold" style="margin:4px 0;">OTROS METODOS</div>
    ${methodsHTML}
  ` : ''}
  <div class="divider"></div>
  <div class="row big"><span>TOTAL VENTAS:</span><span>$${summary.total_sales_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  <div class="divider"></div>
  <div class="center meta" style="margin-top:6px;">Powered by Nivo POS</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=320,height=600');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

// ─── Main Component ──────────────────────────────────────────────

export function CashCloseModal({
  open, sessionId, employeeName, cashRegisterName, onClose, onCloseSession,
}: CashCloseModalProps) {
  const [step, setStep] = useState<'count' | 'reveal'>('count');
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({});
  const [closing, setClosing] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const declaredTotal = MXN_DENOMINATIONS.reduce(
    (sum, d) => sum + d.value * (denomCounts[d.value] || 0), 0,
  );

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('count');
      setDenomCounts({});
      setSummary(null);
    }
  }, [open]);

  const updateDenom = (value: number, count: number) => {
    setDenomCounts((prev) => ({ ...prev, [value]: Math.max(0, count) }));
  };

  const handleDeclareAndClose = async () => {
    setClosing(true);
    try {
      const result = await onCloseSession(declaredTotal);
      setSummary(result.summary);
      setStep('reveal');
    } catch {
      // Error handled by parent
    } finally {
      setClosing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-lg" />

      <div className="relative z-10 w-full max-w-3xl">
        <div className="rounded-2xl bg-slate-900/95 border border-slate-700/40 shadow-2xl backdrop-blur-xl overflow-hidden">

          {step === 'count' ? (
            /* ═══ STEP 1: Blind Count ═══ */
            <>
              <div className="p-4 border-b border-slate-800/60 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Lock className="h-5 w-5 text-amber-400" />
                  <h2 className="text-lg font-bold text-white">Corte Definitivo (Corte Z)</h2>
                </div>
                <p className="text-xs text-slate-500">
                  {cashRegisterName} &middot; {employeeName}
                </p>
                <p className="text-xs text-amber-400/80 mt-1">
                  Cuenta el dinero en la caja sin ver el monto esperado.
                </p>
              </div>

              <div className="flex min-h-[420px]">
                {/* Left: Denomination counter */}
                <div className="flex-1 p-4 overflow-auto">
                  <div className="space-y-1.5">
                    {MXN_DENOMINATIONS.map((d) => (
                      <div key={d.value} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
                        <span className="text-sm font-mono text-slate-300 w-16 flex-shrink-0">{d.label}</span>
                        <div className="flex items-center gap-1.5 flex-1">
                          <button
                            className="w-7 h-7 rounded-md bg-slate-700/60 text-slate-300 hover:bg-slate-600 transition-colors text-sm font-bold flex-shrink-0"
                            onClick={() => updateDenom(d.value, (denomCounts[d.value] || 0) - 1)}
                          >-</button>
                          <Input
                            type="number"
                            min="0"
                            value={denomCounts[d.value] || ''}
                            onChange={(e) => updateDenom(d.value, parseInt(e.target.value) || 0)}
                            className="h-7 w-14 text-center text-sm bg-slate-800/50 border-slate-700/50 text-white"
                          />
                          <button
                            className="w-7 h-7 rounded-md bg-slate-700/60 text-slate-300 hover:bg-slate-600 transition-colors text-sm font-bold flex-shrink-0"
                            onClick={() => updateDenom(d.value, (denomCounts[d.value] || 0) + 1)}
                          >+</button>
                        </div>
                        <span className="text-xs font-mono text-slate-500 w-20 text-right tabular-nums flex-shrink-0">
                          ${(d.value * (denomCounts[d.value] || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Total declared */}
                <div className="w-[240px] border-l border-slate-800/60 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-black/30 to-slate-900/50">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Total Declarado</p>
                  <p
                    className="text-4xl font-bold font-mono tabular-nums text-white mb-8"
                    style={{ textShadow: '0 0 20px rgba(255,255,255,0.1)' }}
                  >
                    ${declaredTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>

                  <Button
                    className="w-full h-12 text-sm font-bold bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20"
                    disabled={closing}
                    onClick={handleDeclareAndClose}
                  >
                    {closing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Declarar y Cerrar Caja'
                    )}
                  </Button>
                  <p className="text-[10px] text-slate-600 mt-2 text-center">
                    Esta accion es irreversible.
                  </p>
                </div>
              </div>
            </>
          ) : summary ? (
            /* ═══ STEP 2: The Reveal ═══ */
            <>
              <div className="p-4 border-b border-slate-800/60 text-center">
                <h2 className="text-lg font-bold text-white">Resumen de Cierre</h2>
                <p className="text-xs text-slate-500">
                  {cashRegisterName} &middot; {employeeName}
                </p>
              </div>

              <div className="flex min-h-[400px]">
                {/* Left: Cash flow breakdown */}
                <div className="flex-1 p-5 space-y-3 overflow-auto">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Flujo de Efectivo</h3>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Fondo Inicial</span>
                      <span className="text-white font-mono tabular-nums">
                        ${summary.opening_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-400">+ Ventas en Efectivo</span>
                      <span className="text-emerald-400 font-mono tabular-nums">
                        ${summary.total_cash_sales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {summary.total_cash_in > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-400/70">+ Entradas de Efectivo</span>
                        <span className="text-emerald-400/70 font-mono tabular-nums">
                          ${summary.total_cash_in.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {summary.total_cash_out > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-red-400">- Retiros de Valores</span>
                        <span className="text-red-400 font-mono tabular-nums">
                          ${summary.total_cash_out.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {summary.total_refunds > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-red-400/70">- Devoluciones</span>
                        <span className="text-red-400/70 font-mono tabular-nums">
                          ${summary.total_refunds.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-700/50 pt-2 space-y-1.5">
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-slate-300">= Efectivo Esperado</span>
                      <span className="text-white font-mono tabular-nums">
                        ${summary.expected_cash.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-slate-300">Efectivo Declarado</span>
                      <span className="text-white font-mono tabular-nums">
                        ${(summary.declared_amount ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Other payment methods */}
                  {summary.payment_methods.length > 0 && (
                    <>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest pt-3">
                        Otros Metodos de Pago
                      </h3>
                      <div className="space-y-1">
                        {summary.payment_methods.map((pm, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-slate-400">
                              {pm.method} <span className="text-slate-600">({pm.count} ops)</span>
                            </span>
                            <span className="text-slate-300 font-mono tabular-nums">
                              ${pm.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Total sales */}
                  <div className="border-t border-slate-700/50 pt-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-white">TOTAL VENTAS ({summary.total_sales_count})</span>
                      <span className="text-white font-mono tabular-nums">
                        ${summary.total_sales_amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Difference display */}
                <div className="w-[260px] border-l border-slate-800/60 flex flex-col items-center justify-center p-6">
                  {(() => {
                    const diff = summary.difference ?? 0;
                    const isShortage = diff < -0.005;
                    const isSurplus = diff > 0.005;
                    const isExact = !isShortage && !isSurplus;

                    return (
                      <>
                        <div className={`h-20 w-20 rounded-full flex items-center justify-center mb-4 ${
                          isExact ? 'bg-emerald-500/15 ring-2 ring-emerald-500/20'
                            : isShortage ? 'bg-red-500/15 ring-2 ring-red-500/20'
                              : 'bg-amber-500/15 ring-2 ring-amber-500/20'
                        }`}>
                          {isExact ? <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                            : isShortage ? <TrendingDown className="h-10 w-10 text-red-400" />
                              : <TrendingUp className="h-10 w-10 text-amber-400" />}
                        </div>

                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Diferencia</p>
                        <p className={`text-3xl font-bold font-mono tabular-nums mb-1 ${
                          isExact ? 'text-emerald-400' : isShortage ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {diff >= 0 ? '+' : '-'}${Math.abs(diff).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                        <p className={`text-sm font-semibold ${
                          isExact ? 'text-emerald-400' : isShortage ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {isExact ? 'CUADRA' : isShortage ? 'FALTANTE' : 'SOBRANTE'}
                        </p>

                        {isShortage && (
                          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-red-400/70">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Revisar con gerencia</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 p-4 border-t border-slate-800/60">
                <button
                  onClick={() => printCloseReceipt(summary)}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir Corte
                </button>
                <Button
                  className="flex-1 h-12 text-base font-bold bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-500/20"
                  onClick={() => onClose(summary)}
                >
                  <ShoppingBag className="h-5 w-5 mr-2" />
                  Finalizar
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
