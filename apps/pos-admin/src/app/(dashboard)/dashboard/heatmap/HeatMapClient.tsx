'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@nivo/ui';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-zinc-800">
      <Skeleton className="h-full w-full rounded-lg" />
    </div>
  ),
});

interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
  customer_name: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
}

interface HeatMapClientProps {
  points: HeatPoint[];
  branches: Branch[];
}

export default function HeatMapClient({ points, branches }: HeatMapClientProps) {
  return <MapView points={points} branches={branches} />;
}
