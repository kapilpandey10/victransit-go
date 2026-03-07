import { useState, useEffect, useCallback } from 'react';
import { fetchNearbyStops, fetchDepartures, fetchDisruptions, PTVStop, PTVDeparture, PTVDisruption } from '@/lib/ptv-api';

export function useNearbyStops(lat: number | null, lon: number | null) {
  const [stops, setStops] = useState<PTVStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!lat || !lon) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNearbyStops(lat, lon, [0, 1, 2], 800);
      setStops(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stops, loading, error, refresh };
}

export function useDepartures(routeType: number | null, stopId: number | null) {
  const [departures, setDepartures] = useState<PTVDeparture[]>([]);
  const [meta, setMeta] = useState<{ routes: any; directions: any; runs: any }>({
    routes: {},
    directions: {},
    runs: {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (routeType === null || stopId === null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDepartures(routeType, stopId, 10);
      setDepartures(data.departures);
      setMeta({ routes: data.routes, directions: data.directions, runs: data.runs });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [routeType, stopId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { departures, meta, loading, error, refresh };
}

export function useDisruptions() {
  const [disruptions, setDisruptions] = useState<PTVDisruption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDisruptions([0, 1, 2]);
      setDisruptions(data.slice(0, 10));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { disruptions, loading, error, refresh };
}
