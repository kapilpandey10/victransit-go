import { useState, useEffect, useCallback } from 'react';
import { fetchRunsByRoute, fetchRouteStops, fetchRouteDirections, PTVRun, PTVStop, PTVDirection } from '@/lib/ptv-api';

export function useRouteTracking(routeId: number | null, routeType: number | null) {
  const [runs, setRuns] = useState<PTVRun[]>([]);
  const [stops, setStops] = useState<PTVStop[]>([]);
  const [directions, setDirections] = useState<PTVDirection[]>([]);
  const [selectedDirection, setSelectedDirection] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (routeId === null || routeType === null) return;
    setLoading(true);
    try {
      const [runsData, dirsData] = await Promise.all([
        fetchRunsByRoute(routeId, routeType),
        fetchRouteDirections(routeId),
      ]);
      setRuns(runsData);
      setDirections(dirsData);
      if (dirsData.length > 0 && selectedDirection === null) {
        setSelectedDirection(dirsData[0].direction_id);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [routeId, routeType, selectedDirection]);

  // Fetch stops when direction changes
  useEffect(() => {
    if (routeId === null || routeType === null) return;
    fetchRouteStops(routeId, routeType, selectedDirection ?? undefined).then(setStops).catch(() => {});
  }, [routeId, routeType, selectedDirection]);

  // Auto-refresh runs every 15s
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const liveRuns = runs.filter(
    (r) =>
      r.vehicle_position?.latitude &&
      r.vehicle_position?.longitude &&
      (selectedDirection === null || r.direction_id === selectedDirection)
  );

  return {
    runs: liveRuns,
    allRuns: runs,
    stops,
    directions,
    selectedDirection,
    setSelectedDirection,
    loading,
    refresh,
  };
}
