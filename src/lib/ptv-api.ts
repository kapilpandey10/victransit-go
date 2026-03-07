import { supabase } from '@/integrations/supabase/client';

export async function fetchPTV(path: string) {
  const { data, error } = await supabase.functions.invoke('ptv-proxy', {
    body: { path },
  });

  if (error) throw new Error(error.message || 'PTV API error');
  return data;
}

export const ROUTE_TYPES = {
  TRAIN: 0,
  TRAM: 1,
  BUS: 2,
  VLINE: 3,
  NIGHT_BUS: 4,
} as const;

export const ROUTE_TYPE_LABELS: Record<number, string> = {
  0: 'Train',
  1: 'Tram',
  2: 'Bus',
  3: 'V/Line',
  4: 'Night Bus',
};

export const ROUTE_TYPE_COLORS: Record<number, string> = {
  0: 'train',
  1: 'tram',
  2: 'bus',
  3: 'train',
  4: 'bus',
};

export interface PTVStop {
  stop_id: number;
  stop_name: string;
  stop_latitude: number;
  stop_longitude: number;
  route_type: number;
  stop_distance?: number;
  stop_suburb?: string;
  routes?: PTVRoute[];
}

export interface PTVRoute {
  route_id: number;
  route_name: string;
  route_number: string;
  route_type: number;
}

export interface PTVDeparture {
  stop_id: number;
  route_id: number;
  run_id: number;
  run_ref: string;
  direction_id: number;
  disruption_ids?: number[];
  scheduled_departure_utc: string;
  estimated_departure_utc: string | null;
  at_platform: boolean;
  platform_number: string | null;
  flags: string;
  departure_sequence: number;
}

export interface PTVDisruption {
  disruption_id: number;
  title: string;
  url: string;
  description: string;
  disruption_status: string;
  disruption_type: string;
  published_on: string;
  last_updated: string;
  from_date: string | null;
  to_date: string | null;
  routes: PTVRoute[];
  colour?: string;
}

export async function fetchNearbyStops(lat: number, lon: number, routeTypes?: number[], maxDistance = 500) {
  let path = `/v3/stops/location/${lat},${lon}?max_distance=${maxDistance}`;
  if (routeTypes) {
    routeTypes.forEach((rt) => {
      path += `&route_types=${rt}`;
    });
  }
  const data = await fetchPTV(path);
  return (data.stops || []) as PTVStop[];
}

export async function fetchDepartures(routeType: number, stopId: number, maxResults = 5) {
  const path = `/v3/departures/route_type/${routeType}/stop/${stopId}?max_results=${maxResults}&expand=route&expand=direction&expand=run`;
  const data = await fetchPTV(path);
  return {
    departures: (data.departures || []) as PTVDeparture[],
    routes: data.routes || {},
    directions: data.directions || {},
    runs: data.runs || {},
  };
}

export async function fetchDisruptions(routeTypes?: number[]) {
  let path = '/v3/disruptions';
  if (routeTypes && routeTypes.length > 0) {
    path += `?route_types=${routeTypes.join('&route_types=')}`;
  }
  const data = await fetchPTV(path);
  const allDisruptions: PTVDisruption[] = [];
  if (data.disruptions) {
    Object.values(data.disruptions).forEach((arr: any) => {
      if (Array.isArray(arr)) allDisruptions.push(...arr);
    });
  }
  return allDisruptions;
}
