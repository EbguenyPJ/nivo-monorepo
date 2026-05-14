'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, AlertTriangle, Banknote, Package, ArrowRight } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface BriefData {
  date: string;
  tenant_name: string;
  greeting: string;
  sales_yesterday: { total_revenue: number; sale_count: number; avg_ticket: number };
  sales_day_before: { total_revenue: number; sale_count: number; avg_ticket: number };
  change_percent: number;
  low_stock_alerts: { count: number; items: { product_name: string; branch_name: string; stock: number; minimum: number }[] };
  cash_discrepancies: { count: number; items: { branch_name: string; employee_name: string; difference: number }[] };
  top_product: { name: string; units: number; revenue: number } | null;
}

function formatCurrency(n: number) {
  return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DailyBriefingModal() {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const fetchBrief = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/analytics/daily-brief');
      setBrief(data);
    } catch {
      // Silently fail — briefing is optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storageKey = `nivo-briefing-seen-${new Date().toISOString().split('T')[0]}`;
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(storageKey)) return;

    fetchBrief().then(() => {
      setOpen(true);
      sessionStorage.setItem(storageKey, '1');
    });
  }, [fetchBrief]);

  if (!open || !brief) return null;

  const isUp = brief.change_percent >= 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        <div className="p-6">
          {/* Close */}
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Greeting */}
          <p className="text-sm text-white/50 mb-1">{brief.greeting}, {user?.email?.split('@')[0] || 'Gerente'}</p>
          <h2 className="text-lg font-semibold text-white mb-4">Resumen del día anterior</h2>

          {/* Revenue card */}
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4 mb-3">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Ventas de ayer</p>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-white">{formatCurrency(brief.sales_yesterday.total_revenue)}</span>
              <span className={`inline-flex items-center gap-1 text-sm font-medium pb-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {isUp ? '+' : ''}{brief.change_percent}% vs antier
              </span>
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <div>
                <span className="text-white/40">Transacciones</span>
                <p className="text-white font-medium">{brief.sales_yesterday.sale_count}</p>
              </div>
              <div>
                <span className="text-white/40">Ticket promedio</span>
                <p className="text-white font-medium">{formatCurrency(brief.sales_yesterday.avg_ticket)}</p>
              </div>
              {brief.top_product && (
                <div>
                  <span className="text-white/40">Top producto</span>
                  <p className="text-white font-medium truncate max-w-[120px]">{brief.top_product.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Alerts row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Low stock */}
            <div className={`rounded-xl p-3 border ${brief.low_stock_alerts.count > 0 ? 'bg-amber-500/[0.06] border-amber-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Package className={`h-4 w-4 ${brief.low_stock_alerts.count > 0 ? 'text-amber-400' : 'text-white/30'}`} />
                <span className="text-xs font-medium text-white/60">Stock bajo</span>
              </div>
              <p className={`text-2xl font-bold ${brief.low_stock_alerts.count > 0 ? 'text-amber-400' : 'text-white/20'}`}>
                {brief.low_stock_alerts.count}
              </p>
              <p className="text-[11px] text-white/40">producto{brief.low_stock_alerts.count !== 1 ? 's' : ''}</p>
            </div>

            {/* Cash discrepancies */}
            <div className={`rounded-xl p-3 border ${brief.cash_discrepancies.count > 0 ? 'bg-red-500/[0.06] border-red-500/20' : 'bg-white/[0.03] border-white/[0.06]'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Banknote className={`h-4 w-4 ${brief.cash_discrepancies.count > 0 ? 'text-red-400' : 'text-white/30'}`} />
                <span className="text-xs font-medium text-white/60">Diferencias caja</span>
              </div>
              <p className={`text-2xl font-bold ${brief.cash_discrepancies.count > 0 ? 'text-red-400' : 'text-white/20'}`}>
                {brief.cash_discrepancies.count}
              </p>
              <p className="text-[11px] text-white/40">arqueo{brief.cash_discrepancies.count !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* CTA */}
          <p className="text-sm text-white/50 text-center">
            ¿Qué deseas revisar primero?
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { setOpen(false); window.location.href = '/dashboard'; }}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.08] text-sm text-white py-2.5 transition"
            >
              Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </button>
            {brief.low_stock_alerts.count > 0 && (
              <button
                onClick={() => { setOpen(false); window.location.href = '/dashboard/inventory'; }}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-sm text-amber-300 py-2.5 transition"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Inventario
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
