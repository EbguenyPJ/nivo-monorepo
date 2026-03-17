'use client';

import { useRef } from 'react';
import {
  Button,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@nivo/ui';
import { Printer, X } from 'lucide-react';

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  sale: {
    id: string;
    total: number;
    paymentMethod: string;
    itemCount: number;
    customerName?: string;
    items: { name: string; variant: string; qty: number; price: number }[];
  };
  branchName: string;
  employeeName: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
};

export function ReceiptDialog({ open, onClose, sale, branchName, employeeName }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!receiptRef.current) return;

    const printWindow = window.open('', '_blank', 'width=320,height=600');
    if (!printWindow) {
      // Fallback: use window.print()
      window.print();
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket de Venta</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            width: 280px;
            padding: 10px;
            font-size: 12px;
            color: #000;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .item-name { font-weight: bold; }
          .item-detail { padding-left: 10px; color: #555; }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 16px;
            margin: 6px 0;
          }
          .small { font-size: 10px; color: #666; }
          h2 { font-size: 18px; margin-bottom: 4px; }
          @media print {
            body { width: auto; }
          }
        </style>
      </head>
      <body>
        <div class="center">
          <h2>NIVO POS</h2>
          <p>${branchName}</p>
          <p class="small">${dateStr}</p>
        </div>
        <div class="divider"></div>
        <div class="row">
          <span>Ticket:</span>
          <span>${sale.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div class="row">
          <span>Cajero:</span>
          <span>${employeeName}</span>
        </div>
        ${sale.customerName ? `<div class="row"><span>Cliente:</span><span>${sale.customerName}</span></div>` : ''}
        <div class="divider"></div>
        ${sale.items.map((item) => `
          <div>
            <div class="item-name">${item.name}</div>
            <div class="row item-detail">
              <span>${item.variant} x${item.qty}</span>
              <span>$${(item.price * item.qty).toFixed(2)}</span>
            </div>
          </div>
        `).join('')}
        <div class="divider"></div>
        <div class="total-row">
          <span>TOTAL</span>
          <span>$${sale.total.toFixed(2)}</span>
        </div>
        <div class="row">
          <span>Método:</span>
          <span>${PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}</span>
        </div>
        <div class="divider"></div>
        <div class="center small" style="margin-top: 8px;">
          <p>¡Gracias por tu compra!</p>
          <p>Powered by Nivo POS</p>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Ticket de Venta
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Preview */}
        <div
          ref={receiptRef}
          className="bg-white text-black rounded-lg p-4 font-mono text-xs space-y-2 border max-h-[400px] overflow-auto"
        >
          <div className="text-center">
            <p className="text-base font-bold">NIVO POS</p>
            <p className="text-[11px]">{branchName}</p>
            <p className="text-[10px] text-gray-500">{dateStr}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="flex justify-between">
            <span>Ticket:</span>
            <span className="font-bold">{sale.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span>Cajero:</span>
            <span>{employeeName}</span>
          </div>
          {sale.customerName && (
            <div className="flex justify-between">
              <span>Cliente:</span>
              <span>{sale.customerName}</span>
            </div>
          )}

          <div className="border-t border-dashed border-gray-400 my-2" />

          {sale.items.map((item, i) => (
            <div key={i}>
              <p className="font-bold">{item.name}</p>
              <div className="flex justify-between pl-2 text-gray-600">
                <span>{item.variant} x{item.qty}</span>
                <span>${(item.price * item.qty).toFixed(2)}</span>
              </div>
            </div>
          ))}

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span>${sale.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Método:</span>
            <span>{PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}</span>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="text-center text-[10px] text-gray-500">
            <p>¡Gracias por tu compra!</p>
            <p>Powered by Nivo POS</p>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button onClick={handlePrint} className="w-full gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
