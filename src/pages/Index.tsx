import { useState, useCallback } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbyStops, useDepartures, useDisruptions } from '@/hooks/usePTVData';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { PTVStop } from '@/lib/ptv-api';
import { TransportMap } from '@/components/TransportMap';
import { BottomSheet } from '@/components/BottomSheet';
import { StopCard, StopCardSkeleton } from '@/components/StopCard';
import { DepartureCard, DepartureCardSkeleton } from '@/components/DepartureCard';
import { DisruptionBanner } from '@/components/DisruptionBanner';
import { TransportBadge } from '@/components/TransportBadge';
import { OfflineBanner } from '@/components/OfflineBanner';
import { MapPin, ArrowLeft, RefreshCw, Star, AlertTriangle, Train, Locate } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { latitude, longitude, loading: geoLoading, denied, requestLocation } = useGeolocation();
  const { stops, loading: stopsLoading, refresh: refreshStops } = useNearbyStops(latitude, longitude);
  const { disruptions } = useDisruptions();
  const { favorites } = useFavoritesStore();

  const [selectedStop, setSelectedStop] = useState<PTVStop | null>(null);
  const [activeTab, setActiveTab] = useState<'nearby' | 'favorites' | 'disruptions'>('nearby');

  const {
    departures,
    meta,
    loading: depLoading,
    refresh: refreshDepartures,
  } = useDepartures(
    selectedStop?.route_type ?? null,
    selectedStop?.stop_id ?? null
  );

  const handleStopClick = useCallback((stop: PTVStop) => {
    setSelectedStop(stop);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedStop(null);
  }, []);

  const handleRefresh = useCallback(() => {
    if (selectedStop) {
      refreshDepartures();
    } else {
      refreshStops();
    }
  }, [selectedStop, refreshDepartures, refreshStops]);

  const mapCenter: [number, number] = selectedStop
    ? [selectedStop.stop_latitude, selectedStop.stop_longitude]
    : [latitude || -37.8136, longitude || 144.9631];

  const userLocation: [number, number] | null =
    latitude && longitude ? [latitude, longitude] : null;

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <OfflineBanner />

      {/* Map */}
      <div className="absolute inset-0 z-0">
        <TransportMap
          center={mapCenter}
          stops={stops}
          onStopClick={handleStopClick}
          userLocation={userLocation}
        />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 p-4 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-card/95 backdrop-blur-md rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-2 flex-1">
            <Train className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground text-sm">PTV Tracker</span>
            <span className="text-xs text-muted-foreground ml-1">Melbourne</span>
          </div>
          <Button
            size="icon"
            variant="secondary"
            className="rounded-xl shadow-lg bg-card/95 backdrop-blur-md h-10 w-10"
            onClick={requestLocation}
            aria-label="Center on my location"
          >
            <Locate className="w-4 h-4" />
          </Button>
        </div>

        {denied && (
          <div className="mt-2 pointer-events-auto bg-bus/10 border border-bus/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-bus" />
            <p className="text-xs text-foreground">
              Location access denied. Showing Melbourne CBD. Enable location in browser settings for nearby stops.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <BottomSheet>
        {selectedStop ? (
          /* Departure Board */
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" onClick={handleBack} className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-foreground text-base truncate">
                  {selectedStop.stop_name}
                </h2>
                <TransportBadge routeType={selectedStop.route_type} />
              </div>
              <Button size="icon" variant="ghost" onClick={refreshDepartures} className="h-8 w-8">
                <RefreshCw className={`w-4 h-4 ${depLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="space-y-2">
              {depLoading && departures.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => <DepartureCardSkeleton key={i} />)
              ) : departures.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No upcoming departures
                </p>
              ) : (
                departures.map((dep, i) => {
                  const route = meta.routes?.[dep.route_id];
                  const direction = meta.directions?.[dep.direction_id];
                  return (
                    <DepartureCard
                      key={`${dep.stop_id}-${dep.scheduled_departure_utc}-${i}`}
                      departure={dep}
                      routeType={selectedStop.route_type}
                      routeName={route?.route_name}
                      routeNumber={route?.route_number}
                      directionName={direction?.direction_name}
                    />
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Main view */
          <div className="space-y-4">
            {/* Tab bar */}
            <div className="flex gap-1 bg-secondary rounded-xl p-1">
              {[
                { key: 'nearby' as const, label: 'Nearby', icon: MapPin },
                { key: 'favorites' as const, label: 'Favorites', icon: Star },
                { key: 'disruptions' as const, label: 'Alerts', icon: AlertTriangle },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === key
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {key === 'disruptions' && disruptions.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-disruption" />
                  )}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-foreground text-base">
                {activeTab === 'nearby' && 'Nearby Stops'}
                {activeTab === 'favorites' && 'Your Favorites'}
                {activeTab === 'disruptions' && 'Disruptions'}
              </h2>
              {activeTab === 'nearby' && (
                <Button size="sm" variant="ghost" onClick={refreshStops}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${stopsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
            </div>

            {/* Content */}
            {activeTab === 'nearby' && (
              <div className="space-y-2">
                {stopsLoading && stops.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => <StopCardSkeleton key={i} />)
                ) : stops.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No stops found nearby. Try adjusting your location.
                  </p>
                ) : (
                  stops.slice(0, 20).map((stop) => (
                    <StopCard
                      key={`${stop.stop_id}-${stop.route_type}`}
                      stop={stop}
                      onClick={() => handleStopClick(stop)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'favorites' && (
              <div className="space-y-2">
                {favorites.length === 0 ? (
                  <div className="text-center py-8">
                    <Star className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No favorites yet. Tap the star on any stop to save it.
                    </p>
                  </div>
                ) : (
                  favorites.map((fav) => (
                    <StopCard
                      key={`fav-${fav.stopId}-${fav.routeType}`}
                      stop={{
                        stop_id: fav.stopId,
                        stop_name: fav.stopName,
                        route_type: fav.routeType,
                        stop_latitude: fav.latitude || 0,
                        stop_longitude: fav.longitude || 0,
                      }}
                      onClick={() =>
                        handleStopClick({
                          stop_id: fav.stopId,
                          stop_name: fav.stopName,
                          route_type: fav.routeType,
                          stop_latitude: fav.latitude || 0,
                          stop_longitude: fav.longitude || 0,
                        })
                      }
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'disruptions' && (
              <DisruptionBanner disruptions={disruptions} />
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
};

export default Index;
