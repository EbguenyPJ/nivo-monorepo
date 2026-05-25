'use client';

import dynamic from 'next/dynamic';

const OrderTrackingMapInner = dynamic(() => import('./OrderTrackingMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-xl bg-zinc-800 animate-pulse flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Cargando mapa...</p>
    </div>
  ),
});

interface Props {
  orderId: string;
  destination?: { lat: number; lng: number; label: string };
}

export default function OrderTrackingMap({ orderId, destination }: Props) {
  return <OrderTrackingMapInner orderId={orderId} destination={destination} />;
}
