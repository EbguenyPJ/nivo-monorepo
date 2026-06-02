'use client';

import { useRef, useState, useEffect, Children, isValidElement, cloneElement } from 'react';

/**
 * Drop-in replacement for Recharts' ResponsiveContainer.
 * Uses ResizeObserver to measure the container width reliably,
 * even during Next.js client-side navigation where the default
 * ResponsiveContainer can measure 0 width.
 */
export function ChartContainer({
  height,
  children,
}: {
  height: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setWidth(w);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: '100%', height }}>
      {width > 0 &&
        Children.map(children, (child) =>
          isValidElement(child)
            ? cloneElement(child, { width, height } as any)
            : child,
        )}
    </div>
  );
}
