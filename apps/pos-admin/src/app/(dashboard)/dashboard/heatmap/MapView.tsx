'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type ZoneMetric = 'density' | 'revenue' | 'delivery';

export interface Zone {
  lat: number;
  lng: number;
  orders: number;
  revenue: number;
  avg_delivery_hours: number | null;
  distance_to_branch_km?: number | null;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface MapViewProps {
  zones: Zone[];
  branches: Branch[];
  metric: ZoneMetric;
  showBranches: boolean;
  blindZoneKm: number;
}

function metricValue(z: Zone, metric: ZoneMetric): number {
  if (metric === 'revenue') return z.revenue;
  if (metric === 'delivery') return z.avg_delivery_hours ?? 0;
  return z.orders;
}

// Warm heat ramp: emerald → amber → orange → red
function heatColor(ratio: number): string {
  if (ratio < 0.25) return '#34d399';
  if (ratio < 0.5) return '#fbbf24';
  if (ratio < 0.75) return '#fb923c';
  return '#ef4444';
}

const fmtMoney = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

const BRANCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#6366f1"/>
  <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="none" stroke="#4f46e5" stroke-width="1"/>
  <circle cx="16" cy="15" r="9" fill="white"/>
  <path d="M10 14h12v1H10zM11 11h10l1 3H10l1-3zM12 15v5h3v-3h2v3h3v-5" fill="#6366f1" stroke="#6366f1" stroke-width="0.5"/>
</svg>`;

export default function MapView({ zones, branches, metric, showBranches, blindZoneKm }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false }).setView([23.6345, -102.5528], 5);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
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

    const values = zones.map((z) => metricValue(z, metric));
    const maxValue = values.length ? Math.max(...values) : 1;
    const allLatLngs: L.LatLng[] = [];

    zones.forEach((zone) => {
      const value = metricValue(zone, metric);
      if (metric === 'delivery' && zone.avg_delivery_hours == null) return;
      const ratio = maxValue > 0 ? value / maxValue : 0;
      const color = heatColor(ratio);
      const isBlind = zone.distance_to_branch_km != null && zone.distance_to_branch_km > blindZoneKm;

      // Soft outer glow + solid core for a heat-blob feel
      L.circleMarker([zone.lat, zone.lng], {
        radius: Math.max(14, Math.min(38, 14 + ratio * 24)),
        fillColor: color,
        color: 'transparent',
        fillOpacity: 0.18,
      }).addTo(map);

      L.circleMarker([zone.lat, zone.lng], {
        radius: Math.max(5, Math.min(16, 5 + ratio * 11)),
        fillColor: color,
        color: isBlind ? '#f59e0b' : color,
        weight: isBlind ? 2 : 1,
        opacity: 0.9,
        fillOpacity: 0.65,
      })
        .bindPopup(
          `<div style="font-family:system-ui;min-width:150px">` +
          `<div style="font-weight:700;font-size:13px;color:#18181b">Zona ${zone.lat.toFixed(2)}, ${zone.lng.toFixed(2)}</div>` +
          `<div style="font-size:12px;color:#52525b;margin-top:3px">${zone.orders} pedido${zone.orders !== 1 ? 's' : ''} · ${fmtMoney(zone.revenue)}</div>` +
          (zone.avg_delivery_hours != null
            ? `<div style="font-size:12px;color:#52525b">Entrega prom: ${Number(zone.avg_delivery_hours).toFixed(1)} h</div>`
            : '') +
          (zone.distance_to_branch_km != null
            ? `<div style="font-size:11px;color:${isBlind ? '#d97706' : '#a1a1aa'}">${Number(zone.distance_to_branch_km).toFixed(1)} km de sucursal${isBlind ? ' — zona ciega' : ''}</div>`
            : '') +
          `</div>`,
        )
        .addTo(map);
      allLatLngs.push(L.latLng(zone.lat, zone.lng));
    });

    if (showBranches) {
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
    }

    // Fit bounds only on first data load so metric/toggle switches keep the view
    if (allLatLngs.length > 0 && !fittedRef.current) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      fittedRef.current = true;
    }
  }, [zones, branches, metric, showBranches, blindZoneKm]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
