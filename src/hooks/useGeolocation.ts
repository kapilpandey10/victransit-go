import { useState, useEffect, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
  denied: boolean;
}

// Default to Melbourne CBD
const MELBOURNE_DEFAULT = { lat: -37.8136, lon: 144.9631 };

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
    denied: false,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState({
        latitude: MELBOURNE_DEFAULT.lat,
        longitude: MELBOURNE_DEFAULT.lon,
        error: 'Geolocation not supported',
        loading: false,
        denied: true,
      });
      return;
    }

    setState((s) => ({ ...s, loading: true }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          loading: false,
          denied: false,
        });
      },
      (err) => {
        setState({
          latitude: MELBOURNE_DEFAULT.lat,
          longitude: MELBOURNE_DEFAULT.lon,
          error: err.message,
          loading: false,
          denied: err.code === err.PERMISSION_DENIED,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { ...state, requestLocation, defaultLocation: MELBOURNE_DEFAULT };
}
