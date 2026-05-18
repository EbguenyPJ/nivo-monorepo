'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface POItem {
  sku: string;
  product_name: string;
  attributes: Record<string, string> | null;
  ordered_quantity: number;
  unit_cost: number;
}

interface POData {
  folio: string;
  supplier: { name: string; email: string | null; tax_id: string | null; phone: string | null };
  branch: { name: string };
  items: POItem[];
  total_cost: number;
  created_at: string;
  expected_date: string | null;
  notes: string | null;
  business_name: string;
  primary_color: string;
  requisition_folio: string | null;
}

function fmt(n: number) {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function fmtDate(s: string) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PurchaseOrderPrintPage() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const poId = params.get('po_id') || '';
  const [data, setData] = useState<POData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !poId) {
      setError('Missing token or po_id');
      return;
    }

    fetch(`${API_BASE}/purchasing/orders/${poId}/print`, {
      headers: { 'X-Print-Token': token, Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token, poId]);

  if (error) {
    return (
      <div data-print-ready="true" style={{ padding: 40, color: '#ef4444' }}>
        Error: {error}
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: 40, color: '#71717a' }}>Cargando...</div>;
  }

  const color = data.primary_color || '#3B82F6';

  return (
    <div
      data-print-ready="true"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: 800,
        margin: '0 auto',
        padding: '32px 40px',
        color: '#18181b',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: `3px solid ${color}`, paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, color, fontWeight: 800 }}>
              Orden de Compra
            </h1>
            <p style={{ margin: '4px 0 0', color: '#71717a', fontSize: 13 }}>
              {data.business_name} · {data.branch.name}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color }}>{data.folio}</p>
            <p style={{ margin: '2px 0 0', color: '#71717a', fontSize: 12 }}>
              Fecha: {fmtDate(data.created_at)}
            </p>
            {data.expected_date && (
              <p style={{ margin: '2px 0 0', color: '#71717a', fontSize: 12 }}>
                Entrega estimada: {fmtDate(data.expected_date)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Supplier info */}
      <div style={{ display: 'flex', gap: 40, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
            Proveedor
          </p>
          <p style={{ margin: '4px 0 0', fontWeight: 600, fontSize: 15 }}>{data.supplier.name}</p>
          {data.supplier.tax_id && <p style={{ margin: '2px 0 0', color: '#52525b' }}>RFC: {data.supplier.tax_id}</p>}
          {data.supplier.email && <p style={{ margin: '2px 0 0', color: '#52525b' }}>{data.supplier.email}</p>}
          {data.supplier.phone && <p style={{ margin: '2px 0 0', color: '#52525b' }}>Tel: {data.supplier.phone}</p>}
        </div>
        {data.requisition_folio && (
          <div>
            <p style={{ margin: 0, fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
              Requisición origen
            </p>
            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{data.requisition_folio}</p>
          </div>
        )}
      </div>

      {/* Items table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: 24,
          fontSize: 12,
        }}
      >
        <thead>
          <tr style={{ background: `${color}10`, borderBottom: `2px solid ${color}40` }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>#</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>SKU</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Producto</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>Cant.</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>Costo Unit.</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => {
            const attrs = item.attributes
              ? Object.values(item.attributes).join(' / ')
              : '';
            return (
              <tr key={i} style={{ borderBottom: '1px solid #e4e4e7' }}>
                <td style={{ padding: '6px 10px', color: '#71717a' }}>{i + 1}</td>
                <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11 }}>{item.sku}</td>
                <td style={{ padding: '6px 10px' }}>
                  {item.product_name}
                  {attrs && <span style={{ color: '#71717a', marginLeft: 4 }}>({attrs})</span>}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>
                  {item.ordered_quantity}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(item.unit_cost)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>
                  {fmt(item.ordered_quantity * item.unit_cost)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${color}40` }}>
            <td colSpan={5} style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>
              Total:
            </td>
            <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color }}>
              {fmt(data.total_cost)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      {data.notes && (
        <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, marginBottom: 24 }}>
          <p style={{ margin: 0, fontSize: 11, color: '#71717a', fontWeight: 600 }}>Notas:</p>
          <p style={{ margin: '4px 0 0' }}>{data.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, borderTop: '1px solid #e4e4e7', paddingTop: 12, color: '#a1a1aa', fontSize: 10, textAlign: 'center' }}>
        <p style={{ margin: 0 }}>
          Documento generado por Nivo POS · {new Date().toLocaleString('es-MX')}
        </p>
      </div>
    </div>
  );
}
