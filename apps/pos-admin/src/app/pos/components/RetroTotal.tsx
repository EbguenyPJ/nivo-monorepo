'use client';

import { useEffect, useState } from 'react';

interface RetroTotalProps {
  subtotal: number;
  tax: number;
  total: number;
}

export function RetroTotal({ subtotal, tax, total }: RetroTotalProps) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 300);
    return () => clearTimeout(timer);
  }, [total]);

  const formatMoney = (n: number) =>
    n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-black rounded-xl p-4 border border-[#39FF14]/10">
      {/* Subtotal + Tax */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-[#39FF14]/50 text-[10px] font-mono uppercase tracking-widest">
          Subtotal
        </span>
        <span className="text-[#39FF14]/60 text-sm font-mono tabular-nums">
          ${formatMoney(subtotal)}
        </span>
      </div>
      {tax > 0 && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-[#39FF14]/50 text-[10px] font-mono uppercase tracking-widest">
            IVA
          </span>
          <span className="text-[#39FF14]/60 text-sm font-mono tabular-nums">
            ${formatMoney(tax)}
          </span>
        </div>
      )}

      <div className="border-t border-[#39FF14]/10 my-2" />

      {/* Total */}
      <div className="flex justify-between items-center">
        <span className="text-[#39FF14]/70 text-xs font-mono uppercase tracking-widest font-bold">
          Total
        </span>
        <span
          className={`text-[#39FF14] text-3xl font-mono font-bold tabular-nums transition-all duration-300 ${
            flash ? 'scale-105 brightness-150' : ''
          }`}
          style={{
            textShadow: '0 0 12px rgba(57, 255, 20, 0.6), 0 0 30px rgba(57, 255, 20, 0.2)',
          }}
        >
          ${formatMoney(total)}
        </span>
      </div>
    </div>
  );
}
