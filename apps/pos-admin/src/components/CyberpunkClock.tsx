'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface CyberpunkClockProps {
  /** When true the full clock is rendered; when false it's hidden (only the header icon shows) */
  visible: boolean;
  /** Called when the user clicks the close button on the clock */
  onClose: () => void;
}

export default function CyberpunkClock({ visible, onClose }: CyberpunkClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  // ── Drag state ────────────────────────────────────────────────
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset from default position
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const clockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Drag handlers ─────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Don't start drag if clicking close button
    if ((e.target as HTMLElement).closest('[data-clock-close]')) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPos({ x: posStart.current.x + dx, y: posStart.current.y + dy });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!now || !visible) return null;

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const day = now.toLocaleDateString('es-MX', { weekday: 'short' }).toUpperCase();
  const date = String(now.getDate()).padStart(2, '0');
  const month = now.toLocaleDateString('es-MX', { month: 'short' }).toUpperCase();
  const year = now.getFullYear();

  return (
    <div
      ref={clockRef}
      className="cyber-clock"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Glow backdrop */}
      <div className="cyber-clock__glow" />

      {/* Main container */}
      <div className="cyber-clock__body">
        {/* Close / minimize button */}
        <button
          data-clock-close
          onClick={onClose}
          className="cyber-clock__close"
          title="Minimizar reloj"
        >
          ✕
        </button>

        {/* Top accent line */}
        <div className="cyber-clock__accent-top" />

        {/* Time display */}
        <div className="cyber-clock__time">
          <span className="cyber-clock__digit">{hh}</span>
          <span className="cyber-clock__colon">:</span>
          <span className="cyber-clock__digit">{mm}</span>
          <span className="cyber-clock__colon cyber-clock__colon--dim">:</span>
          <span className="cyber-clock__digit cyber-clock__digit--sec">{ss}</span>
        </div>

        {/* Date row */}
        <div className="cyber-clock__date">
          <span className="cyber-clock__tag">{day}</span>
          <span className="cyber-clock__date-text">
            {date} {month} {year}
          </span>
        </div>

        {/* Bottom accent line */}
        <div className="cyber-clock__accent-bottom" />
      </div>

      <style jsx>{`
        .cyber-clock {
          position: fixed;
          top: 72px;
          right: 20px;
          z-index: 9999;
          user-select: none;
          cursor: grab;
          touch-action: none;
        }
        .cyber-clock:active {
          cursor: grabbing;
        }

        .cyber-clock__glow {
          position: absolute;
          inset: -6px;
          border-radius: 16px;
          background: radial-gradient(
            ellipse at 50% 50%,
            rgba(0, 255, 245, 0.08) 0%,
            transparent 70%
          );
          filter: blur(8px);
          z-index: 0;
          pointer-events: none;
        }

        .cyber-clock__body {
          position: relative;
          z-index: 1;
          background: linear-gradient(
            135deg,
            rgba(10, 10, 20, 0.92) 0%,
            rgba(15, 15, 35, 0.95) 50%,
            rgba(10, 10, 20, 0.92) 100%
          );
          border: 1px solid rgba(0, 255, 245, 0.15);
          border-radius: 12px;
          padding: 8px 16px 8px 16px;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 20px rgba(0, 255, 245, 0.05),
            0 8px 32px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            inset 0 -1px 0 rgba(0, 0, 0, 0.3);
          overflow: hidden;
        }

        .cyber-clock__close {
          position: absolute;
          top: 4px;
          right: 6px;
          z-index: 10;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: rgba(0, 255, 245, 0.3);
          font-size: 10px;
          line-height: 1;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.15s;
          padding: 0;
        }
        .cyber-clock__close:hover {
          color: rgba(0, 255, 245, 0.8);
          background: rgba(0, 255, 245, 0.1);
        }

        .cyber-clock__accent-top {
          position: absolute;
          top: 0;
          left: 16px;
          right: 16px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(0, 255, 245, 0.5) 30%,
            rgba(0, 255, 245, 0.8) 50%,
            rgba(0, 255, 245, 0.5) 70%,
            transparent 100%
          );
        }

        .cyber-clock__accent-bottom {
          position: absolute;
          bottom: 0;
          left: 24px;
          right: 24px;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(191, 0, 255, 0.3) 30%,
            rgba(191, 0, 255, 0.5) 50%,
            rgba(191, 0, 255, 0.3) 70%,
            transparent 100%
          );
        }

        .cyber-clock__time {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 1px;
          line-height: 1;
        }

        .cyber-clock__digit {
          font-family: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #00fff5;
          text-shadow:
            0 0 8px rgba(0, 255, 245, 0.6),
            0 0 20px rgba(0, 255, 245, 0.2);
        }

        .cyber-clock__digit--sec {
          font-size: 14px;
          color: rgba(0, 255, 245, 0.5);
          font-weight: 500;
          text-shadow: 0 0 6px rgba(0, 255, 245, 0.3);
          min-width: 20px;
        }

        .cyber-clock__colon {
          font-family: 'JetBrains Mono', monospace;
          font-size: 20px;
          font-weight: 700;
          color: rgba(0, 255, 245, 0.7);
          margin: 0 1px;
          animation: pulse-colon 1s ease-in-out infinite;
        }

        .cyber-clock__colon--dim {
          color: rgba(0, 255, 245, 0.3);
          font-size: 14px;
          margin: 0 0 0 2px;
        }

        @keyframes pulse-colon {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        .cyber-clock__date {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 4px;
        }

        .cyber-clock__tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1.5px;
          color: #0a0a14;
          background: linear-gradient(135deg, #00fff5, #00ccbb);
          padding: 1px 5px;
          border-radius: 3px;
          line-height: 1.4;
        }

        .cyber-clock__date-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 1.5px;
          color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}
