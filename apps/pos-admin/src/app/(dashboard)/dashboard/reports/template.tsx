'use client';

import { usePathname } from 'next/navigation';

/**
 * Force React to unmount/remount the page component on every
 * client-side navigation between report sub-routes.
 *
 * Without this, Next.js may reuse the component instance when
 * navigating between sibling routes (e.g. /reports → /reports/sales),
 * causing useState not to re-initialise and useEffect not to re-fire.
 *
 * The key={pathname} trick tells React the subtree is "new",
 * guaranteeing fresh state and effects on every route change.
 */
export default function ReportsTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname}>{children}</div>;
}
