import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PTVStop, ROUTE_TYPE_COLORS } from '@/lib/ptv-api';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createStopIcon(routeType: number) {
  const colors: Record<string, string> = {
    train: '#0066cc',
    tram: '#2d8a4e',
    bus: '#ff8200',
  };
  const color = colors[ROUTE_TYPE_COLORS[routeType] || 'train'] || '#0066cc';

  return L.divIcon({
    html: `<div style="
      width: 14px; height: 14px;
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

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  const prevCenter = useRef(center);

  useEffect(() => {
    if (
      prevCenter.current[0] !== center[0] ||
      prevCenter.current[1] !== center[1]
    ) {
      map.flyTo(center, 15, { duration: 1 });
      prevCenter.current = center;
    }
  }, [center, map]);

  return null;
}

interface TransportMapProps {
  center: [number, number];
  stops: PTVStop[];
  onStopClick: (stop: PTVStop) => void;
  userLocation?: [number, number] | null;
}

export function TransportMap({ center, stops, onStopClick, userLocation }: TransportMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom={true}
      zoomControl={false}
      className="w-full h-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <MapUpdater center={center} />

      {userLocation && (
        <Marker
          position={userLocation}
          icon={L.divIcon({
            html: `<div style="
              width: 16px; height: 16px;
              background: #4285f4;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 0 4px rgba(66,133,244,0.3), 0 2px 6px rgba(0,0,0,0.3);
            "></div>`,
            className: '',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })}
        >
          <Popup>You are here</Popup>
        </Marker>
      )}

      {stops.map((stop) => (
        <Marker
          key={`${stop.stop_id}-${stop.route_type}`}
          position={[stop.stop_latitude, stop.stop_longitude]}
          icon={createStopIcon(stop.route_type)}
          eventHandlers={{ click: () => onStopClick(stop) }}
        >
          <Popup>
            <strong>{stop.stop_name}</strong>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
