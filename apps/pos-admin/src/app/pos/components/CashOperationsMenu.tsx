'use client';

import { useState } from 'react';
import { Button, Input, toast } from '@nivo/ui';
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, X, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────

type OperationType = 'cash_in' | 'cash_out' | 'audit' | null;

interface CashOperationsMenuProps {
  sessionId: string;
  employeeId: string;
  onComplete?: () => void;
}

// ─── Denomination calculator for MXN ─────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────

export function CashOperationsMenu({ sessionId, employeeId, onComplete }: CashOperationsMenuProps) {
  const [operation, setOperation] = useState<OperationType>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Denomination counter for audit
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({});

  const denomTotal = MXN_DENOMINATIONS.reduce(
    (sum, d) => sum + d.value * (denomCounts[d.value] || 0), 0,
  );

  const updateDenom = (value: number, count: number) => {
    setDenomCounts((prev) => ({ ...prev, [value]: Math.max(0, count) }));
  };

  const resetState = () => {
    setOperation(null);
    setAmount('');
    setDescription('');
    setDenomCounts({});
  };

  // ─── Submit handlers ────────────────────────────────────────

  const handleCashIn = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setLoading(true);
    try {
      await apiClient.post('/pos/cash/in', {
        session_id: sessionId,
        employee_id: employeeId,
        amount: amt,
        description: description || undefined,
      });
      toast({ title: 'Entrada registrada', description: `$${amt.toFixed(2)} ingresados a la caja.` });
      resetState();
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo registrar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCashOut = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setLoading(true);
    try {
      await apiClient.post('/pos/cash/out', {
        session_id: sessionId,
        employee_id: employeeId,
        amount: amt,
        description: description || undefined,
      });
      toast({ title: 'Retiro registrado', description: `$${amt.toFixed(2)} retirados de la caja.` });
      resetState();
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo registrar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async () => {
    if (denomTotal <= 0) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/pos/cash/audit', {
        session_id: sessionId,
        employee_id: employeeId,
        declared_amount: denomTotal,
      });
      const diff = res.data.difference || 0;
      const diffStr = diff > 0
        ? `Sobrante: +$${diff.toFixed(2)}`
        : diff < 0
          ? `Faltante: -$${Math.abs(diff).toFixed(2)}`
          : 'Sin diferencia';
      toast({
        title: 'Arqueo registrado',
        description: `Declarado: $${denomTotal.toFixed(2)} | ${diffStr}`,
      });
      resetState();
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'No se pudo registrar.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!operation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={!loading ? resetState : undefined} />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl bg-slate-900/95 border border-slate-700/40 shadow-2xl backdrop-blur-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              {operation === 'cash_in' && <ArrowDownToLine className="h-5 w-5 text-emerald-400" />}
              {operation === 'cash_out' && <ArrowUpFromLine className="h-5 w-5 text-red-400" />}
              {operation === 'audit' && <ClipboardCheck className="h-5 w-5 text-cyan-400" />}
              <h2 className="text-lg font-bold text-white">
                {operation === 'cash_in' && 'Entrada de Efectivo'}
                {operation === 'cash_out' && 'Retiro de Valores'}
                {operation === 'audit' && 'Arqueo de Caja (Corte X)'}
              </h2>
            </div>
            <button onClick={resetState} disabled={loading} className="p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-white transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {operation === 'audit' ? (
              /* ─── Denomination Counter ─── */
              <>
                <p className="text-xs text-slate-500 text-center">
                  Cuenta el dinero y registra las cantidades por denominacion.
                </p>
                <div className="max-h-[300px] overflow-auto space-y-1.5">
                  {MXN_DENOMINATIONS.map((d) => (
                    <div key={d.value} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
                      <span className="text-sm font-mono text-slate-300 w-16">{d.label}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          className="w-8 h-8 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-600 transition-colors text-lg font-bold"
                          onClick={() => updateDenom(d.value, (denomCounts[d.value] || 0) - 1)}
                        >-</button>
                        <Input
                          type="number"
                          min="0"
                          value={denomCounts[d.value] || ''}
                          onChange={(e) => updateDenom(d.value, parseInt(e.target.value) || 0)}
                          className="h-8 w-16 text-center text-sm bg-slate-800/50 border-slate-700/50 text-white"
                        />
                        <button
                          className="w-8 h-8 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-600 transition-colors text-lg font-bold"
                          onClick={() => updateDenom(d.value, (denomCounts[d.value] || 0) + 1)}
                        >+</button>
                      </div>
                      <span className="text-sm font-mono text-slate-400 w-20 text-right tabular-nums">
                        ${(d.value * (denomCounts[d.value] || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="bg-black/50 rounded-xl p-4 text-center border border-slate-700/30">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Total Declarado</p>
                  <p className="text-3xl font-bold font-mono text-white tabular-nums">
                    ${denomTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <Button
                  className="w-full h-12 text-base font-bold bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-500/20"
                  disabled={denomTotal <= 0 || loading}
                  onClick={handleAudit}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Registrar Arqueo'}
                </Button>
              </>
            ) : (
              /* ─── Cash In / Cash Out ─── */
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Monto</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-2xl h-14 text-center font-mono bg-slate-800/50 border-slate-700/50 text-white focus:border-cyan-500/50"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Descripcion (opcional)</label>
                  <Input
                    placeholder={operation === 'cash_in' ? 'Ej: Fondo extra para cambio' : 'Ej: Retiro de seguridad'}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-slate-800/50 border-slate-700/50 text-white focus:border-cyan-500/50 placeholder:text-slate-600"
                  />
                </div>
                <Button
                  className={`w-full h-12 text-base font-bold shadow-lg ${
                    operation === 'cash_in'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                      : 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                  }`}
                  disabled={!parseFloat(amount) || parseFloat(amount) <= 0 || loading}
                  onClick={operation === 'cash_in' ? handleCashIn : handleCashOut}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    operation === 'cash_in' ? 'Registrar Entrada' : 'Registrar Retiro'
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Exported hook for triggering from parent
export function useCashOperation() {
  const [operation, setOperation] = useState<OperationType>(null);
  return {
    operation,
    openCashIn: () => setOperation('cash_in'),
    openCashOut: () => setOperation('cash_out'),
    openAudit: () => setOperation('audit'),
    close: () => setOperation(null),
    CashOperationsMenuWithState: ({
      sessionId, employeeId, onComplete,
    }: Omit<CashOperationsMenuProps, 'operation'>) => {
      if (!operation) return null;
      return (
        <CashOperationsMenuInternal
          sessionId={sessionId}
          employeeId={employeeId}
          operation={operation}
          onComplete={() => { setOperation(null); onComplete?.(); }}
          onClose={() => setOperation(null)}
        />
      );
    },
  };
}

// Internal version with operation prop
function CashOperationsMenuInternal({
  sessionId, employeeId, operation, onComplete, onClose,
}: CashOperationsMenuProps & { operation: OperationType; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({});

  const denomTotal = MXN_DENOMINATIONS.reduce(
    (sum, d) => sum + d.value * (denomCounts[d.value] || 0), 0,
  );

  const updateDenom = (value: number, count: number) => {
    setDenomCounts((prev) => ({ ...prev, [value]: Math.max(0, count) }));
  };

  const handleCashIn = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setLoading(true);
    try {
      await apiClient.post('/pos/cash/in', {
        session_id: sessionId, employee_id: employeeId, amount: amt, description: description || undefined,
      });
      toast({ title: 'Entrada registrada', description: `$${amt.toFixed(2)} ingresados a la caja.` });
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleCashOut = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setLoading(true);
    try {
      await apiClient.post('/pos/cash/out', {
        session_id: sessionId, employee_id: employeeId, amount: amt, description: description || undefined,
      });
      toast({ title: 'Retiro registrado', description: `$${amt.toFixed(2)} retirados de la caja.` });
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleAudit = async () => {
    if (denomTotal <= 0) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/pos/cash/audit', {
        session_id: sessionId, employee_id: employeeId, declared_amount: denomTotal,
      });
      const diff = res.data.difference || 0;
      const diffStr = diff > 0 ? `Sobrante: +$${diff.toFixed(2)}` : diff < 0 ? `Faltante: -$${Math.abs(diff).toFixed(2)}` : 'Sin diferencia';
      toast({ title: 'Arqueo registrado', description: `Declarado: $${denomTotal.toFixed(2)} | ${diffStr}` });
      onComplete?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (!operation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={!loading ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl bg-slate-900/95 border border-slate-700/40 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              {operation === 'cash_in' && <ArrowDownToLine className="h-5 w-5 text-emerald-400" />}
              {operation === 'cash_out' && <ArrowUpFromLine className="h-5 w-5 text-red-400" />}
              {operation === 'audit' && <ClipboardCheck className="h-5 w-5 text-cyan-400" />}
              <h2 className="text-lg font-bold text-white">
                {operation === 'cash_in' && 'Entrada de Efectivo'}
                {operation === 'cash_out' && 'Retiro de Valores'}
                {operation === 'audit' && 'Arqueo de Caja (Corte X)'}
              </h2>
            </div>
            <button onClick={onClose} disabled={loading} className="p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-white transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            {operation === 'audit' ? (
              <>
                <p className="text-xs text-slate-500 text-center">Cuenta el dinero y registra las cantidades.</p>
                <div className="max-h-[300px] overflow-auto space-y-1.5">
                  {MXN_DENOMINATIONS.map((d) => (
                    <div key={d.value} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
                      <span className="text-sm font-mono text-slate-300 w-16">{d.label}</span>
                      <div className="flex items-center gap-2 flex-1">
                        <button className="w-8 h-8 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-600 transition-colors text-lg font-bold" onClick={() => updateDenom(d.value, (denomCounts[d.value] || 0) - 1)}>-</button>
                        <Input type="number" min="0" value={denomCounts[d.value] || ''} onChange={(e) => updateDenom(d.value, parseInt(e.target.value) || 0)} className="h-8 w-16 text-center text-sm bg-slate-800/50 border-slate-700/50 text-white" />
                        <button className="w-8 h-8 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-slate-600 transition-colors text-lg font-bold" onClick={() => updateDenom(d.value, (denomCounts[d.value] || 0) + 1)}>+</button>
                      </div>
                      <span className="text-sm font-mono text-slate-400 w-20 text-right tabular-nums">${(d.value * (denomCounts[d.value] || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-black/50 rounded-xl p-4 text-center border border-slate-700/30">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Total Declarado</p>
                  <p className="text-3xl font-bold font-mono text-white tabular-nums">${denomTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                </div>
                <Button className="w-full h-12 text-base font-bold bg-cyan-600 hover:bg-cyan-500" disabled={denomTotal <= 0 || loading} onClick={handleAudit}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Registrar Arqueo'}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Monto</label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-2xl h-14 text-center font-mono bg-slate-800/50 border-slate-700/50 text-white" autoFocus />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Descripcion (opcional)</label>
                  <Input placeholder={operation === 'cash_in' ? 'Ej: Fondo extra para cambio' : 'Ej: Retiro de seguridad'} value={description} onChange={(e) => setDescription(e.target.value)} className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600" />
                </div>
                <Button
                  className={`w-full h-12 text-base font-bold ${operation === 'cash_in' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
                  disabled={!parseFloat(amount) || parseFloat(amount) <= 0 || loading}
                  onClick={operation === 'cash_in' ? handleCashIn : handleCashOut}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (operation === 'cash_in' ? 'Registrar Entrada' : 'Registrar Retiro')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
