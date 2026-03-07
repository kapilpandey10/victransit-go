import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PTVStop, ROUTE_TYPE_COLORS } from '@/lib/ptv-api';

// Keep default icon assets available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface TransportMapProps {
  center: [number, number];
  stops: PTVStop[];
  onStopClick: (stop: PTVStop) => void;
  userLocation?: [number, number] | null;
}

const routeColorHex: Record<string, string> = {
  train: '#0066cc',
  tram: '#2d8a4e',
  bus: '#ff8200',
};

function createStopIcon(routeType: number) {
  const mode = ROUTE_TYPE_COLORS[routeType] || 'train';
  const color = routeColorHex[mode] || routeColorHex.train;

  return L.divIcon({
    html: `<div style="
      width: 14px;
      height: 14px;
      background: ${color};
      border: 2.5px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function TransportMap({ center, stops, onStopClick, userLocation }: TransportMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView(center, 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const stopsLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    stopsLayerRef.current = stopsLayer;

    return () => {
      map.remove();
      mapRef.current = null;
      stopsLayerRef.current = null;
      userMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo(center, map.getZoom(), { duration: 0.8 });
  }, [center]);

  // Update stops
  useEffect(() => {
    const map = mapRef.current;
    const stopsLayer = stopsLayerRef.current;
    if (!map || !stopsLayer) return;

    stopsLayer.clearLayers();

    stops.forEach((stop) => {
      const marker = L.marker([stop.stop_latitude, stop.stop_longitude], {
        icon: createStopIcon(stop.route_type),
      });

      marker.bindPopup(`<strong>${escapeHtml(stop.stop_name)}</strong>`);
      marker.on('click', () => onStopClick(stop));
      marker.addTo(stopsLayer);
    });
  }, [stops, onStopClick]);

  // Update user marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userLocation) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      return;
    }

    const icon = L.divIcon({
      html: `<div style="
        width: 16px;
        height: 16px;
        background: #4285f4;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(66,133,244,0.3), 0 2px 6px rgba(0,0,0,0.3);
      "></div>`,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(userLocation, { icon }).addTo(map);
      userMarkerRef.current.bindPopup('You are here');
    } else {
      userMarkerRef.current.setLatLng(userLocation);
    }
  }, [userLocation]);

  return <div ref={containerRef} className="w-full h-full" aria-label="Transport map" />;
}
