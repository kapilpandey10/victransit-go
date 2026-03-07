import { PTVRoute, PTVStop, PTVRun, PTVDirection, ROUTE_TYPE_LABELS } from '@/lib/ptv-api';
import { TransportBadge } from './TransportBadge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Radio, MapPin } from 'lucide-react';

interface RouteTrackerViewProps {
  route: PTVRoute;
  stops: PTVStop[];
  runs: PTVRun[];
  directions: PTVDirection[];
  selectedDirection: number | null;
  onSelectDirection: (id: number) => void;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onStopClick: (stop: PTVStop) => void;
}

export function RouteTrackerView({
  route,
  stops,
  runs,
  directions,
  selectedDirection,
  onSelectDirection,
  loading,
  onBack,
  onRefresh,
  onStopClick,
}: RouteTrackerViewProps) {
  const liveCount = runs.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TransportBadge routeType={route.route_type} />
            {route.route_number && (
              <span className="font-bold text-foreground">{route.route_number}</span>
            )}
          </div>
          <h2 className="font-bold text-foreground text-sm truncate mt-0.5">
            {route.route_name}
          </h2>
        </div>
        <Button size="icon" variant="ghost" onClick={onRefresh} className="h-8 w-8">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Live vehicles count */}
      <div className="flex items-center gap-2 bg-realtime/10 border border-realtime/20 rounded-lg px-3 py-2">
        <Radio className="w-4 h-4 text-realtime animate-pulse-realtime" />
        <span className="text-sm font-medium text-foreground">
          {liveCount} vehicle{liveCount !== 1 ? 's' : ''} tracked live
        </span>
      </div>

      {/* Direction selector */}
      {directions.length > 1 && (
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {directions.map((dir) => (
            <button
              key={dir.direction_id}
              onClick={() => onSelectDirection(dir.direction_id)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all truncate ${
                selectedDirection === dir.direction_id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {dir.direction_name}
            </button>
          ))}
        </div>
      )}

      {/* Live vehicles list */}
      {liveCount > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Live Vehicles
          </p>
          {runs.map((run) => (
            <div
              key={run.run_id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border"
            >
              <div className="w-8 h-8 rounded-full bg-realtime/10 flex items-center justify-center">
                <Radio className="w-3.5 h-3.5 text-realtime" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {run.destination_name || 'In service'}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {run.vehicle_descriptor?.description && (
                    <span>{run.vehicle_descriptor.description}</span>
                  )}
                  {run.vehicle_descriptor?.low_floor && (
                    <span className="text-primary">♿ Low floor</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-realtime font-medium animate-pulse-realtime">
                LIVE
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stops on route */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Stops on route ({stops.length})
        </p>
        <div className="relative">
          {/* Route line */}
          <div className="absolute left-[18px] top-3 bottom-3 w-0.5 bg-border" />
          {stops.map((stop, i) => (
            <button
              key={stop.stop_id}
              onClick={() => onStopClick(stop)}
              className="w-full flex items-center gap-3 py-2 px-1 hover:bg-accent/50 rounded-lg transition-colors relative text-left"
            >
              <div className="w-[22px] flex items-center justify-center relative z-10">
                <div className="w-3 h-3 rounded-full bg-card border-2 border-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{stop.stop_name}</p>
              </div>
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
