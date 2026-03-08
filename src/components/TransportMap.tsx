import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PTVStop, PTVRun, ROUTE_TYPE_COLORS } from '@/lib/ptv-api';

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
  vehiclePositions?: PTVRun[];
  routeStops?: PTVStop[];
  routeType?: number | null;
}

const routeColorHex: Record<string, string> = {
  train: '#0066cc',
  tram: '#2d8a4e',
  bus: '#ff8200',
};

function getColorForRouteType(routeType: number): string {
  const mode = ROUTE_TYPE_COLORS[routeType] || 'train';
  return routeColorHex[mode] || routeColorHex.train;
}

function createStopIcon(routeType: number) {
  const color = getColorForRouteType(routeType);
  return L.divIcon({
    html: `<div style="width:14px;height:14px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function createVehicleIcon(routeType: number) {
  const color = getColorForRouteType(routeType);
  return L.divIcon({
    html: `<div style="
      width:24px;height:24px;
      background:${color};
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 0 0 3px ${color}44, 0 3px 8px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round">
        <circle cx="12" cy="12" r="4"/>
      </svg>
    </div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createRouteStopIcon() {
  return L.divIcon({
    html: `<div style="width:10px;height:10px;background:white;border:2px solid #0066cc;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
    className: '',
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

function escapeHtml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function TransportMap({
  center,
  stops,
  onStopClick,
  userLocation,
  vehiclePositions = [],
  routeStops = [],
  routeType = null,
}: TransportMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

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

    stopsLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      stopsLayerRef.current = null;
      vehiclesLayerRef.current = null;
      routeLayerRef.current = null;
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
    const layer = stopsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    stops.forEach((stop) => {
      const marker = L.marker([stop.stop_latitude, stop.stop_longitude], {
        icon: createStopIcon(stop.route_type),
      });
      marker.bindPopup(`<strong>${escapeHtml(stop.stop_name)}</strong>`);
      marker.on('click', () => onStopClick(stop));
      marker.addTo(layer);
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
      html: `<div style="width:16px;height:16px;background:#4285f4;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(66,133,244,0.3),0 2px 6px rgba(0,0,0,0.3);"></div>`,
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

  // Update vehicle positions
  useEffect(() => {
    const layer = vehiclesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    vehiclePositions.forEach((run) => {
      if (!run.vehicle_position?.latitude || !run.vehicle_position?.longitude) return;
      const marker = L.marker(
        [run.vehicle_position.latitude, run.vehicle_position.longitude],
        { icon: createVehicleIcon(run.route_type), zIndexOffset: 1000 }
      );
      const dest = run.destination_name ? escapeHtml(run.destination_name) : 'In service';
      const lowFloor = run.vehicle_descriptor?.low_floor ? '<br/>♿ Low floor' : '';
      marker.bindPopup(`<strong>${dest}</strong>${lowFloor}`);
      marker.addTo(layer);
    });
  }, [vehiclePositions]);

  // Draw route line through stops
  useEffect(() => {
    const layer = routeLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    if (routeStops.length === 0) return;

    const coords: [number, number][] = routeStops
      .filter((s) => s.stop_latitude && s.stop_longitude)
      .map((s) => [s.stop_latitude, s.stop_longitude]);

    if (coords.length > 1) {
      const polyline = L.polyline(coords, {
        color: '#0066cc',
        weight: 3,
        opacity: 0.6,
        dashArray: '8 6',
      }).addTo(layer);

      // Add small stop markers on route
      routeStops.forEach((stop) => {
        if (!stop.stop_latitude || !stop.stop_longitude) return;
        const m = L.marker([stop.stop_latitude, stop.stop_longitude], {
          icon: createRouteStopIcon(),
        });
        m.bindPopup(`<strong>${escapeHtml(stop.stop_name)}</strong>`);
        m.addTo(layer);
      });

      // Fit bounds to show full route
      map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 14 });
    }
  }, [routeStops]);

  return <div ref={containerRef} className="w-full h-full" aria-label="Transport map" />;
}
