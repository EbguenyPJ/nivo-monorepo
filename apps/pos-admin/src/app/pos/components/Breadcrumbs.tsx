'use client';

import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (id: string | null, index: number) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm py-2.5 px-1">
      {/* Home pill */}
      <button
        type="button"
        onClick={() => onNavigate(null, -1)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/80 backdrop-blur-sm transition-all duration-200"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Inicio</span>
      </button>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={item.id} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-slate-600" />
            {isLast ? (
              <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold backdrop-blur-sm border border-amber-500/20 shadow-sm shadow-amber-500/10">
                {item.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(item.id, idx)}
                className="px-3 py-1.5 rounded-full bg-slate-800/40 text-slate-400 text-xs font-medium hover:text-white hover:bg-slate-700/60 backdrop-blur-sm transition-all duration-200"
              >
                {item.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
