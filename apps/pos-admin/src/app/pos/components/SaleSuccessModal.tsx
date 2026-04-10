'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Button } from '@nivo/ui';
import { CheckCircle2, Printer, ShoppingBag } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

export interface SaleReceiptData {
  id: string;
  total: number;
  paymentMethod: string;
  itemCount: number;
  customerName?: string;
  items: { name: string; variant: string; qty: number; unitPrice: number }[];
  payments: { method: string; amount: number; reference?: string | null }[];
  cashChange: number;
}

export interface TicketConfig {
  branch: {
    name: string;
    address: string | null;
    city: string | null;
    zip_code: string | null;
    phone: string | null;
    ticket_footer: string | null;
  } | null;
  settings: {
    auto_print_receipt: boolean;
    show_logo: boolean;
    show_branch_address: boolean;
    business_name: string;
    rfc: string;
    footer_message: string;
  };
}

interface SaleSuccessModalProps {
  open: boolean;
  sale: SaleReceiptData | null;
  ticketConfig: TicketConfig | null;
  employeeName: string;
  onClose: () => void;
}

// ─── Receipt HTML Generator ──────────────────────────────────────

function generateReceiptHTML(sale: SaleReceiptData, config: TicketConfig | null, employeeName: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });

  const branchName = config?.branch?.name || 'Sucursal';
  const businessName = config?.settings?.business_name || 'NIVO POS';
  const rfc = config?.settings?.rfc || '';
  const showAddress = config?.settings?.show_branch_address !== false;
  const footerMsg = config?.settings?.footer_message || 'Gracias por tu compra!';
  const branchFooter = config?.branch?.ticket_footer || '';
  const address = config?.branch?.address || '';
  const city = config?.branch?.city || '';
  const phone = config?.branch?.phone || '';

  const subtotal = sale.total;
  // IVA desglose (precio ya incluye IVA, se calcula inverso)
  const taxRate = 0.16;
  const subtotalSinIVA = subtotal / (1 + taxRate);
  const iva = subtotal - subtotalSinIVA;

  const itemsHTML = sale.items.map((item) => {
    const lineTotal = item.unitPrice * item.qty;
    const showUnit = item.qty > 1;
    return `
      <div class="item">
        <div class="item-name">${item.name}</div>
        <div class="item-row">
          <span class="item-variant">${item.variant}</span>
          <span class="item-qty">${item.qty}</span>
          <span class="item-total">${showUnit ? `${item.qty} x $${item.unitPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })} = ` : ''}$${lineTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    `;
  }).join('');

  const paymentsHTML = sale.payments.map((p) => `
    <div class="payment-row">
      <span>${p.method}</span>
      <span>$${p.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
    </div>
    ${p.reference ? `<div class="ref-row">Ref: ${p.reference}</div>` : ''}
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Ticket</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Roboto Mono', monospace;
      width: 80mm;
      padding: 4mm;
      font-size: 11px;
      color: #000;
      line-height: 1.4;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .business-name { font-size: 16px; font-weight: bold; letter-spacing: 1px; }
    .branch-name { font-size: 12px; margin-top: 2px; }
    .meta { font-size: 9px; color: #444; }
    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
    .info-row { display: flex; justify-content: space-between; font-size: 10px; margin: 1px 0; }
    .item { margin: 4px 0; }
    .item-name { font-weight: bold; font-size: 11px; }
    .item-row {
      display: flex;
      align-items: baseline;
      font-size: 10px;
      padding-left: 2mm;
      color: #333;
    }
    .item-variant { flex: 1; min-width: 0; }
    .item-qty { width: 8mm; text-align: center; flex-shrink: 0; }
    .item-total { width: 28mm; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 4px; }
    .totals-row { display: flex; justify-content: space-between; font-size: 10px; margin: 1px 0; }
    .totals-row.grand {
      font-size: 14px;
      font-weight: bold;
      margin: 4px 0;
      padding: 2px 0;
    }
    .payment-row { display: flex; justify-content: space-between; font-size: 10px; margin: 1px 0; }
    .ref-row { font-size: 9px; color: #555; padding-left: 2mm; }
    .change-row {
      display: flex; justify-content: space-between;
      font-size: 12px; font-weight: bold;
      margin: 3px 0;
      padding: 2px 0;
    }
    .footer { font-size: 9px; color: #444; margin-top: 6px; text-align: center; }
    .barcode { margin-top: 6px; text-align: center; }
    .barcode-text { font-size: 8px; color: #666; letter-spacing: 1px; }
    @media print {
      body { width: auto; margin: 0; padding: 2mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="center">
    <div class="business-name">${businessName}</div>
    <div class="branch-name">${branchName}</div>
    ${showAddress && address ? `<div class="meta">${address}${city ? `, ${city}` : ''}</div>` : ''}
    ${phone ? `<div class="meta">Tel: ${phone}</div>` : ''}
    ${rfc ? `<div class="meta">RFC: ${rfc}</div>` : ''}
    <div class="meta">${dateStr} ${timeStr}</div>
  </div>

  <div class="divider"></div>

  <!-- Sale info -->
  <div class="info-row"><span>Ticket:</span><span class="bold">${sale.id.slice(0, 8).toUpperCase()}</span></div>
  <div class="info-row"><span>Cajero:</span><span>${employeeName}</span></div>
  ${sale.customerName ? `<div class="info-row"><span>Cliente:</span><span>${sale.customerName}</span></div>` : ''}

  <div class="divider"></div>

  <!-- Items -->
  ${itemsHTML}

  <div class="divider"></div>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>$${subtotalSinIVA.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
    <div class="totals-row"><span>IVA 16%</span><span>$${iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
    <div class="totals-row grand"><span>TOTAL</span><span>$${sale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>
  </div>

  <div class="divider"></div>

  <!-- Payments -->
  ${paymentsHTML}
  ${sale.cashChange > 0 ? `<div class="change-row"><span>CAMBIO</span><span>$${sale.cashChange.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></div>` : ''}

  <div class="divider"></div>

  <!-- Barcode (sale ID) -->
  <div class="barcode">
    <div class="barcode-text">${sale.id.toUpperCase()}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    ${branchFooter ? `<div>${branchFooter}</div>` : ''}
    <div>${footerMsg}</div>
    <div style="margin-top:3px;font-size:8px;">Powered by Nivo POS</div>
  </div>
</body>
</html>`;
}

// ─── Print function ──────────────────────────────────────────────

function triggerPrint(sale: SaleReceiptData, config: TicketConfig | null, employeeName: string) {
  const html = generateReceiptHTML(sale, config, employeeName);
  const printWindow = window.open('', '_blank', 'width=320,height=600');
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}

// ─── Main Component ──────────────────────────────────────────────

export function SaleSuccessModal({ open, sale, ticketConfig, employeeName, onClose }: SaleSuccessModalProps) {
  const hasAutoPrinted = useRef(false);

  // Auto-print on open
  useEffect(() => {
    if (!open || !sale || hasAutoPrinted.current) return;
    if (ticketConfig?.settings?.auto_print_receipt) {
      hasAutoPrinted.current = true;
      setTimeout(() => triggerPrint(sale, ticketConfig, employeeName), 200);
    }
  }, [open, sale, ticketConfig, employeeName]);

  // Reset auto-print flag when modal closes
  useEffect(() => {
    if (!open) hasAutoPrinted.current = false;
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open || !sale) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onClose();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        triggerPrint(sale, ticketConfig, employeeName);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, sale, ticketConfig, employeeName, onClose]);

  if (!open || !sale) return null;

  // Derived values for preview
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });

  const branchName = ticketConfig?.branch?.name || 'Sucursal';
  const businessName = ticketConfig?.settings?.business_name || 'NIVO POS';
  const rfc = ticketConfig?.settings?.rfc || '';
  const showAddress = ticketConfig?.settings?.show_branch_address !== false;
  const footerMsg = ticketConfig?.settings?.footer_message || 'Gracias por tu compra!';
  const address = ticketConfig?.branch?.address || '';
  const city = ticketConfig?.branch?.city || '';
  const phone = ticketConfig?.branch?.phone || '';
  const branchFooter = ticketConfig?.branch?.ticket_footer || '';

  const taxRate = 0.16;
  const subtotalSinIVA = sale.total / (1 + taxRate);
  const iva = sale.total - subtotalSinIVA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-3xl">
        <div className="rounded-2xl bg-slate-900/95 border border-slate-700/40 shadow-2xl shadow-black/50 backdrop-blur-xl overflow-hidden">

          {/* Two-column layout */}
          <div className="flex min-h-[480px]">
            {/* ═══ LEFT — Success State ═══ */}
            <div className="w-[38%] flex flex-col items-center justify-center p-6 border-r border-slate-800/60 bg-gradient-to-b from-slate-900 to-slate-950">
              {/* Success icon */}
              <div className="h-20 w-20 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4 ring-2 ring-emerald-500/20">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1">Venta Registrada</h2>
              <p className="text-sm text-slate-500 mb-6">exitosamente</p>

              {/* Total */}
              <div className="text-center mb-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Total</p>
                <p
                  className="text-3xl font-bold font-mono tabular-nums text-[#39FF14]"
                  style={{ textShadow: '0 0 12px rgba(57, 255, 20, 0.6), 0 0 30px rgba(57, 255, 20, 0.2)' }}
                >
                  ${sale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>

              {/* Change (cash) */}
              {sale.cashChange > 0 && (
                <div className="text-center mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 w-full">
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1">Cambio a devolver</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-amber-400">
                    ${sale.cashChange.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}

              {/* Sale details */}
              <div className="w-full space-y-1.5 mt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Metodo</span>
                  <span className="text-slate-300">{sale.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Articulos</span>
                  <span className="text-slate-300">{sale.itemCount}</span>
                </div>
                {sale.customerName && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Cliente</span>
                    <span className="text-slate-300 truncate ml-2">{sale.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Ticket</span>
                  <span className="text-slate-400 font-mono">{sale.id.slice(0, 8).toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* ═══ RIGHT — Ticket Preview ═══ */}
            <div className="flex-1 flex flex-col">
              <div className="p-3 border-b border-slate-800/60">
                <p className="text-xs font-semibold text-slate-400 text-center">Vista previa del ticket</p>
              </div>

              <div className="flex-1 overflow-auto p-4 flex justify-center">
                {/* Paper simulation */}
                <div className="w-[280px] flex-shrink-0">
                  {/* Zigzag top */}
                  <div
                    className="h-3 w-full"
                    style={{
                      background: 'linear-gradient(135deg, transparent 33.33%, #f5f5f0 33.33%, #f5f5f0 66.66%, transparent 66.66%), linear-gradient(225deg, transparent 33.33%, #f5f5f0 33.33%, #f5f5f0 66.66%, transparent 66.66%)',
                      backgroundSize: '8px 100%',
                    }}
                  />

                  {/* Paper body */}
                  <div className="bg-[#f5f5f0] text-black px-4 py-3 font-mono text-[11px] leading-relaxed shadow-lg">
                    {/* Header */}
                    <div className="text-center mb-2">
                      <p className="text-sm font-bold tracking-wide">{businessName}</p>
                      <p className="text-[10px]">{branchName}</p>
                      {showAddress && address && (
                        <p className="text-[9px] text-gray-500">{address}{city ? `, ${city}` : ''}</p>
                      )}
                      {phone && <p className="text-[9px] text-gray-500">Tel: {phone}</p>}
                      {rfc && <p className="text-[9px] text-gray-500">RFC: {rfc}</p>}
                      <p className="text-[9px] text-gray-400 mt-0.5">{dateStr} {timeStr}</p>
                    </div>

                    <div className="border-b border-dashed border-gray-400 my-2" />

                    {/* Sale info */}
                    <div className="flex justify-between text-[10px]">
                      <span>Ticket:</span>
                      <span className="font-bold">{sale.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>Cajero:</span>
                      <span>{employeeName}</span>
                    </div>
                    {sale.customerName && (
                      <div className="flex justify-between text-[10px]">
                        <span>Cliente:</span>
                        <span>{sale.customerName}</span>
                      </div>
                    )}

                    <div className="border-b border-dashed border-gray-400 my-2" />

                    {/* Items */}
                    {sale.items.map((item, i) => {
                      const lineTotal = item.unitPrice * item.qty;
                      return (
                        <div key={i} className="mb-1.5">
                          <p className="font-bold text-[11px]">{item.name}</p>
                          <div className="flex items-baseline text-[10px] pl-1.5 text-gray-600">
                            <span className="flex-1 truncate">{item.variant}</span>
                            <span className="w-6 text-center flex-shrink-0">{item.qty}</span>
                            <span className="w-24 text-right flex-shrink-0 tabular-nums">
                              {item.qty > 1
                                ? `${item.qty} x $${item.unitPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })} = $${lineTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                                : `$${lineTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                              }
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    <div className="border-b border-dashed border-gray-400 my-2" />

                    {/* Totals */}
                    <div className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span>Subtotal</span>
                        <span className="tabular-nums">${subtotalSinIVA.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>IVA 16%</span>
                        <span className="tabular-nums">${iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold mt-1">
                        <span>TOTAL</span>
                        <span className="tabular-nums">${sale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="border-b border-dashed border-gray-400 my-2" />

                    {/* Payments */}
                    {sale.payments.map((p, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-[10px]">
                          <span>{p.method}</span>
                          <span className="tabular-nums">${p.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {p.reference && (
                          <p className="text-[9px] text-gray-500 pl-1.5">Ref: {p.reference}</p>
                        )}
                      </div>
                    ))}
                    {sale.cashChange > 0 && (
                      <div className="flex justify-between text-[11px] font-bold mt-1">
                        <span>CAMBIO</span>
                        <span className="tabular-nums">${sale.cashChange.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div className="border-b border-dashed border-gray-400 my-2" />

                    {/* Barcode area */}
                    <div className="text-center mt-1">
                      <p className="text-[8px] text-gray-400 tracking-widest font-mono">{sale.id.toUpperCase()}</p>
                    </div>

                    {/* Footer */}
                    <div className="text-center mt-2 text-[9px] text-gray-500">
                      {branchFooter && <p>{branchFooter}</p>}
                      <p>{footerMsg}</p>
                      <p className="text-[8px] mt-1 text-gray-400">Powered by Nivo POS</p>
                    </div>
                  </div>

                  {/* Zigzag bottom */}
                  <div
                    className="h-3 w-full"
                    style={{
                      background: 'linear-gradient(315deg, transparent 33.33%, #f5f5f0 33.33%, #f5f5f0 66.66%, transparent 66.66%), linear-gradient(45deg, transparent 33.33%, #f5f5f0 33.33%, #f5f5f0 66.66%, transparent 66.66%)',
                      backgroundSize: '8px 100%',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Action Buttons ═══ */}
          <div className="flex gap-3 p-4 border-t border-slate-800/60">
            <button
              onClick={() => triggerPrint(sale, ticketConfig, employeeName)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800/60 border border-slate-700/30 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium"
            >
              <Printer className="h-4 w-4" />
              Imprimir Ticket
              <span className="text-[10px] text-slate-600 font-mono ml-1">(P)</span>
            </button>
            <Button
              className="flex-1 h-12 text-base font-bold bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-500/20"
              onClick={onClose}
            >
              <ShoppingBag className="h-5 w-5 mr-2" />
              Nueva Venta
              <span className="text-xs text-cyan-200/60 font-mono ml-2">(Enter)</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
