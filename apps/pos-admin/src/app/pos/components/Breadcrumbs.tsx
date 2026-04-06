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
    <nav className="flex items-center gap-1 text-sm py-2 px-1 min-h-[36px]">
      <button
        type="button"
        onClick={() => onNavigate(null, -1)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-muted"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Inicio</span>
      </button>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={item.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            {isLast ? (
              <span className="font-semibold text-foreground px-1.5 py-0.5">
                {item.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(item.id, idx)}
                className="text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-muted"
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
