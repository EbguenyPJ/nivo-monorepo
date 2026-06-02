'use client';

import { usePathname } from 'next/navigation';
import { Receipt, BarChart3, PieChart, ClipboardCheck, Users } from 'lucide-react';

const tabs = [
  { href: '/dashboard/reports', label: 'Resumen', icon: Receipt },
  { href: '/dashboard/reports/sales', label: 'Ventas', icon: BarChart3 },
  { href: '/dashboard/reports/profitability', label: 'Rentabilidad', icon: PieChart },
  { href: '/dashboard/reports/audits', label: 'Arqueos', icon: ClipboardCheck },
  { href: '/dashboard/reports/performance', label: 'Rendimiento', icon: Users },
];

export function ReportTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2 border-b border-white/10 pb-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </a>
        );
      })}
    </div>
  );
}
