'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiClient } from '@/lib/api';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const driverIcon = new L.DivIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,.3)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
});

const destIcon = new L.DivIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,.3)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
}

interface Props {
  orderId: string;
  destination?: { lat: number; lng: number; label: string };
}

interface TrackingPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export default function OrderTrackingMapInner({ orderId, destination }: Props) {
  const [history, setHistory] = useState<TrackingPoint[]>([]);
  const [latest, setLatest] = useState<TrackingPoint | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        const [histRes, latRes] = await Promise.all([
          apiClient.get(`/api/v1/logistics/tracking/${orderId}`),
          apiClient.get(`/api/v1/logistics/tracking/${orderId}/latest`),
        ]);
        setHistory(histRes.data);
        setLatest(latRes.data);
      } catch {}
    };

    fetchTracking();
    intervalRef.current = setInterval(fetchTracking, 15_000);
    return () => clearInterval(intervalRef.current);
  }, [orderId]);

  const routePoints: [number, number][] = history.map((p) => [
    Number(p.latitude),
    Number(p.longitude),
  ]);

  const allPoints: [number, number][] = [...routePoints];
  if (latest) allPoints.push([Number(latest.latitude), Number(latest.longitude)]);
  if (destination) allPoints.push([destination.lat, destination.lng]);

  const center: [number, number] = latest
    ? [Number(latest.latitude), Number(latest.longitude)]
    : destination
      ? [destination.lat, destination.lng]
      : [23.6345, -102.5528];

  return (
    <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {allPoints.length > 1 && <FitBounds points={allPoints} />}

      {routePoints.length > 1 && (
        <Polyline positions={routePoints} pathOptions={{ color: '#3b82f6', weight: 3 }} />
      )}

      {latest && (
        <Marker position={[Number(latest.latitude), Number(latest.longitude)]} icon={driverIcon}>
          <Popup>
            <strong>Repartidor</strong><br />
            Última actualización: {new Date(latest.timestamp).toLocaleTimeString('es-MX')}
          </Popup>
        </Marker>
      )}

      {destination && (
        <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
          <Popup>{destination.label}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
