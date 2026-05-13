'use client';

/**
 * /print/[report]?token=xxx&start_date=...&end_date=...&branch_id=...
 *
 * This page is rendered by Puppeteer in headless mode.
 * It fetches the report data using the one-time JWT token,
 * renders a print-ready layout, and signals readiness via
 * data-print-ready="true" so Puppeteer knows when to snap the PDF.
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportType = 'sales' | 'profitability' | 'audits' | 'performance' | 'dashboard';

interface ReportData {
  reportType: ReportType;
  businessName: string;
  branchName?: string;
  primaryColor: string;
  period: { start: string; end: string };
  summary: Record<string, number | string>;
  rows: any[];
  chartData?: any[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function fmt(n: number) {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Print Layout ─────────────────────────────────────────────────────────────

function PrintHeader({ data }: { data: ReportData }) {
  const color = data.primaryColor || '#3B82F6';
  const title: Record<ReportType, string> = {
    sales:         'Reporte de Ventas',
    profitability: 'Reporte de Rentabilidad',
    audits:        'Arqueos y Cortes de Caja',
    performance:   'Rendimiento por Vendedor',
    dashboard:     'Resumen Ejecutivo',
  };
  return (
    <div style={{ borderBottom: `3px solid ${color}`, paddingBottom: 16, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color, fontWeight: 800 }}>
            {title[data.reportType]}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#71717a', fontSize: 13 }}>
            {data.businessName}{data.branchName ? ` · ${data.branchName}` : ''}
          </p>
        </div>
        <div style={{ textAlign: 'right', color: '#71717a', fontSize: 12 }}>
          <p style={{ margin: 0 }}>
            Periodo: {fmtDate(data.period.start)} — {fmtDate(data.period.end)}
          </p>
          <p style={{ margin: '2px 0 0' }}>
            Generado: {new Date().toLocaleString('es-MX')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Report-specific renderers ────────────────────────────────────────────────

function SalesReport({ data }: { data: ReportData }) {
  const color = data.primaryColor;
  const PAYMENT_COLORS: Record<string, string> = {
    cash: '#10b981', card: '#3b82f6', mixed: '#f59e0b', online: '#8b5cf6',
  };
  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Ventas', value: String(data.summary.total_sales ?? 0) },
          { label: 'Ingresos Totales', value: fmt(Number(data.summary.total_revenue ?? 0)) },
          { label: 'Ticket Promedio', value: fmt(Number(data.summary.avg_ticket ?? 0)) },
        ].map((k) => (
          <div key={k.label} style={{ border: `1px solid #e4e4e7`, borderRadius: 10, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</p>
            <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Payment breakdown chart */}
      {data.chartData && data.chartData.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Método de Pago</h3>
          <PieChart width={300} height={180}>
            <Pie data={data.chartData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={70} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
              {data.chartData.map((d: any) => (
                <Cell key={d.label} fill={PAYMENT_COLORS[d.key] ?? color} />
              ))}
            </Pie>
          </PieChart>
        </div>
      )}

      {/* Sales table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: color }}>
            {['Ticket', 'Fecha', 'Cliente', 'Cajero', 'Método', 'Total'].map((h) => (
              <th key={h} style={{ padding: '6px 10px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).slice(0, 50).map((r: any, i: number) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
              <td style={{ padding: '5px 10px', fontFamily: 'monospace' }}>{r.id?.slice(0, 8).toUpperCase()}</td>
              <td style={{ padding: '5px 10px' }}>{fmtDate(r.created_at)}</td>
              <td style={{ padding: '5px 10px' }}>{r.customer?.name ?? '—'}</td>
              <td style={{ padding: '5px 10px' }}>{r.employee?.name ?? '—'}</td>
              <td style={{ padding: '5px 10px' }}>{r.payment_method}</td>
              <td style={{ padding: '5px 10px', fontWeight: 600, textAlign: 'right' }}>{fmt(Number(r.total_amount))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: color }}>
            <td colSpan={5} style={{ padding: '6px 10px', color: '#fff', fontWeight: 700 }}>TOTAL</td>
            <td style={{ padding: '6px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>
              {fmt(data.rows.reduce((s: number, r: any) => s + Number(r.total_amount), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

function ProfitabilityReport({ data }: { data: ReportData }) {
  const color = data.primaryColor;
  return (
    <>
      {/* Scatter chart */}
      {data.chartData && data.chartData.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Margen vs Volumen por Marca</h3>
          <ScatterChart width={580} height={200}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="units" name="Unidades" tick={{ fontSize: 10 }} />
            <YAxis dataKey="margin" name="Margen %" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any, name: string) => [name === 'Margen %' ? `${Number(v).toFixed(1)}%` : v, name]} />
            <Scatter data={data.chartData} fill={color} fillOpacity={0.8} />
          </ScatterChart>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: color }}>
            {['Marca', 'Unidades', 'Ingresos', 'Costo', 'Utilidad', 'Margen %'].map((h) => (
              <th key={h} style={{ padding: '6px 10px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).map((r: any, i: number) => {
            const margin = r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0;
            const mc = margin >= 40 ? '#10b981' : margin >= 20 ? '#f59e0b' : '#ef4444';
            return (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                <td style={{ padding: '5px 10px', fontWeight: 600 }}>{r.brand}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{r.units}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(r.revenue)}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(r.cost)}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(r.revenue - r.cost)}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: mc }}>{margin.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function AuditsReport({ data }: { data: ReportData }) {
  const color = data.primaryColor;
  const net = data.rows.reduce((s: number, r: any) => s + Number(r.difference), 0);
  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Diferencia Neta', value: fmt(net), c: net >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Días Analizados', value: String(data.rows.length), c: color },
          { label: 'Días Sobrante', value: String(data.rows.filter((r: any) => r.difference > 0).length), c: '#10b981' },
          { label: 'Días Faltante', value: String(data.rows.filter((r: any) => r.difference < 0).length), c: '#ef4444' },
        ].map((k) => (
          <div key={k.label} style={{ border: '1px solid #e4e4e7', borderRadius: 10, padding: 14 }}>
            <p style={{ margin: 0, fontSize: 10, color: '#71717a', textTransform: 'uppercase' }}>{k.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: k.c }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ marginBottom: 24 }}>
        <BarChart width={580} height={160} data={[...data.rows].reverse()}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} />
          <ReferenceLine y={0} stroke="#71717a" strokeWidth={1.5} />
          <Bar dataKey="difference" radius={[3, 3, 0, 0]}>
            {[...data.rows].reverse().map((d: any, i: number) => (
              <Cell key={i} fill={d.difference >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: color }}>
            {['Fecha', 'Cortes', 'Diferencia', 'Estado'].map((h) => (
              <th key={h} style={{ padding: '6px 10px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...data.rows].reverse().map((r: any, i: number) => {
            const d = Number(r.difference);
            const c = d > 0 ? '#10b981' : d < 0 ? '#ef4444' : '#71717a';
            return (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                <td style={{ padding: '5px 10px' }}>{fmtDate(r.date)}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{r.session_count}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: c }}>{fmt(d)}</td>
                <td style={{ padding: '5px 10px', color: c }}>{d > 0 ? 'Sobrante' : d < 0 ? 'Faltante' : 'Exacto'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function PerformanceReport({ data }: { data: ReportData }) {
  const color = data.primaryColor;
  return (
    <>
      {data.chartData && data.chartData.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Ingresos por Vendedor</h3>
          <BarChart width={580} height={160} data={data.chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="seller" tick={{ fontSize: 9 }} width={100} />
            <Tooltip formatter={(v: any) => [fmt(Number(v)), 'Ingresos']} />
            <Bar dataKey="total_revenue" fill={color} radius={[0, 4, 4, 0]} fillOpacity={0.85} />
          </BarChart>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: color }}>
            {['Vendedor', 'Ventas', 'Ingresos Totales', 'Ticket Prom.', 'UPT'].map((h) => (
              <th key={h} style={{ padding: '6px 10px', color: '#fff', fontWeight: 600, textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).map((r: any, i: number) => {
            const uptColor = r.upt >= 2 ? '#10b981' : r.upt >= 1.2 ? '#f59e0b' : '#ef4444';
            return (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                <td style={{ padding: '5px 10px', fontWeight: 600 }}>{r.seller}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{r.sale_count}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(r.total_revenue)}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right' }}>{fmt(r.avg_ticket)}</td>
                <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: uptColor }}>{Number(r.upt).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const reportType = params.report as ReportType;

  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    const token     = searchParams.get('token') ?? '';
    const startDate = searchParams.get('start_date') ?? '';
    const endDate   = searchParams.get('end_date') ?? '';
    const branchId  = searchParams.get('branch_id') ?? '';

    if (!token) { setError('Token de impresión requerido'); return; }

    const qs = new URLSearchParams({
      report_type: reportType, token,
      ...(startDate && { start_date: startDate }),
      ...(endDate   && { end_date: endDate }),
      ...(branchId  && { branch_id: branchId }),
    });

    fetch(`${API_BASE}/reports/export/print-data?${qs}`, {
      headers: { 'X-Print-Token': token },
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: ReportData) => {
        setData(d);
        readyRef.current = true;
        // Signal puppeteer
        document.body.setAttribute('data-print-ready', 'true');
      })
      .catch((e) => setError(e.message));
  }, [reportType, searchParams]);

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', color: '#ef4444' }}>
        <p>Error al cargar el reporte: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui', color: '#71717a', textAlign: 'center' }}>
        <p>Generando reporte...</p>
      </div>
    );
  }

  return (
    <div
      data-print-ready="true"
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 12,
        color: '#18181b',
        padding: '24px 32px',
        maxWidth: 900,
        margin: '0 auto',
        backgroundColor: '#fff',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        @media print {
          body { margin: 0; }
          @page { margin: 10mm; size: A4; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <PrintHeader data={data} />

      {reportType === 'sales'         && <SalesReport data={data} />}
      {reportType === 'profitability' && <ProfitabilityReport data={data} />}
      {reportType === 'audits'        && <AuditsReport data={data} />}
      {reportType === 'performance'   && <PerformanceReport data={data} />}

      {/* Footer */}
      <div style={{ marginTop: 32, borderTop: '1px solid #e4e4e7', paddingTop: 12, display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: 10 }}>
        <span>Generado con Nivo POS</span>
        <span>{data.businessName}</span>
      </div>
    </div>
  );
}
