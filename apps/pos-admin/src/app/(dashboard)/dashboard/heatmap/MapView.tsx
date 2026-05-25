'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  city?: string;
  lat?: number | null;
  lng?: number | null;
}

interface MapViewProps {
  points: HeatPoint[];
  branches: Branch[];
}

function getColor(weight: number, maxWeight: number): string {
  const ratio = maxWeight > 0 ? weight / maxWeight : 0;
  if (ratio < 0.33) return '#22c55e';
  if (ratio < 0.66) return '#eab308';
  return '#ef4444';
}

function getRadius(weight: number, maxWeight: number): number {
  if (maxWeight === 0) return 6;
  const ratio = weight / maxWeight;
  return Math.max(6, Math.min(20, 6 + ratio * 14));
}

const BRANCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#6366f1"/>
  <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="none" stroke="#4f46e5" stroke-width="1"/>
  <circle cx="16" cy="15" r="9" fill="white"/>
  <path d="M10 14h12v1H10zM11 11h10l1 3H10l1-3zM12 15v5h3v-3h2v3h3v-5" fill="#6366f1" stroke="#6366f1" stroke-width="0.5"/>
</svg>`;

export default function MapView({ points, branches }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([23.6345, -102.5528], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear all non-tile layers
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    const maxWeight = points.length > 0 ? Math.max(...points.map((p) => p.weight)) : 1;
    const allLatLngs: L.LatLng[] = [];

    // Customer points
    points.forEach((point) => {
      const color = getColor(point.weight, maxWeight);
      L.circleMarker([point.lat, point.lng], {
        radius: getRadius(point.weight, maxWeight),
        fillColor: color,
        color: color,
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.6,
      })
        .bindPopup(
          `<div style="font-family:system-ui;min-width:120px">` +
          `<div style="font-weight:600;font-size:13px;color:#18181b">${point.customer_name}</div>` +
          `<div style="font-size:12px;color:#71717a;margin-top:2px">${point.weight} compra${point.weight !== 1 ? 's' : ''}</div>` +
          `</div>`,
        )
        .addTo(map);
      allLatLngs.push(L.latLng(point.lat, point.lng));
    });

    // Branch markers with store icon
    const branchIcon = L.divIcon({
      html: BRANCH_SVG,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popupAnchor: [0, -42],
      className: '',
    });

    branches.forEach((branch) => {
      if (branch.lat == null || branch.lng == null) return;
      L.marker([branch.lat, branch.lng], { icon: branchIcon, zIndexOffset: 1000 })
        .bindPopup(
          `<div style="font-family:system-ui;min-width:140px">` +
          `<div style="font-weight:700;font-size:13px;color:#4f46e5">🏪 ${branch.name}</div>` +
          `<div style="font-size:12px;color:#52525b;margin-top:3px">${branch.address || ''}</div>` +
          `${branch.city ? `<div style="font-size:11px;color:#a1a1aa">${branch.city}</div>` : ''}` +
          `</div>`,
        )
        .addTo(map);
      allLatLngs.push(L.latLng(branch.lat, branch.lng));
    });

    // Fit bounds to show all markers
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [points, branches]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }} />;
}
