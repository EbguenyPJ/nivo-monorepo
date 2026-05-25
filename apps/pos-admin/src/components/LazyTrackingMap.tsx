'use client';

import { useEffect, useState, useRef, type ComponentType } from 'react';

interface TrackingMapProps {
  orderId: string;
  destination?: { lat: number; lng: number; label: string };
}

/**
 * Lazy-loads OrderTrackingMapInner AFTER mount using a manual dynamic import.
 * This avoids next/dynamic issues when rendering inside Radix Dialog portals.
 */
export default function LazyTrackingMap(props: TrackingMapProps) {
  const [MapComponent, setMapComponent] = useState<ComponentType<TrackingMapProps> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    import('./OrderTrackingMapInner').then((mod) => {
      if (mountedRef.current) {
        setMapComponent(() => mod.default);
      }
    });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!MapComponent) {
    return (
      <div className="h-full w-full rounded-xl bg-zinc-800 animate-pulse flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Cargando mapa...</p>
      </div>
    );
  }

  return <MapComponent {...props} />;
}
