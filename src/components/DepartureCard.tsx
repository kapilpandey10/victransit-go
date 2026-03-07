import { useMemo } from 'react';
import { PTVDeparture } from '@/lib/ptv-api';
import { TransportBadge } from './TransportBadge';
import { cn } from '@/lib/utils';
import { Radio } from 'lucide-react';

interface DepartureCardProps {
  departure: PTVDeparture;
  routeType: number;
  routeName?: string;
  routeNumber?: string;
  directionName?: string;
  onTrackRoute?: () => void;
}

export function DepartureCard({
  departure,
  routeType,
  routeName,
  routeNumber,
  directionName,
}: DepartureCardProps) {
  const isRealtime = !!departure.estimated_departure_utc;
  const departureTime = departure.estimated_departure_utc || departure.scheduled_departure_utc;

  const countdown = useMemo(() => {
    const now = new Date();
    const dep = new Date(departureTime);
    const diffMs = dep.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins <= 0) return 'Now';
    if (diffMins === 1) return '1 min';
    return `${diffMins} min`;
  }, [departureTime]);

  const timeStr = useMemo(() => {
    const dep = new Date(departureTime);
    return dep.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  }, [departureTime]);

  const isNow = countdown === 'Now';

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/20 transition-colors">
      {/* Route info */}
      <div className="flex-shrink-0">
        <TransportBadge routeType={routeType} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {routeNumber && (
            <span className="font-bold text-sm text-foreground">{routeNumber}</span>
          )}
          <span className="text-sm text-foreground truncate">
            {directionName || routeName || 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{timeStr}</span>
          {departure.platform_number && (
            <span className="text-xs text-muted-foreground">
              Plat. {departure.platform_number}
            </span>
          )}
        </div>
      </div>

      {/* Countdown */}
      <div className="flex-shrink-0 text-right">
        <div
          className={cn(
            'text-lg font-bold tabular-nums',
            isRealtime ? 'text-realtime animate-pulse-realtime' : 'text-scheduled',
            isNow && 'text-xl'
          )}
        >
          {countdown}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {isRealtime ? 'Live' : 'Sched'}
        </div>
      </div>
    </div>
  );
}

export function DepartureCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
      <div className="w-14 h-6 rounded-full skeleton-shimmer" />
      <div className="flex-1 space-y-2">
        <div className="w-3/4 h-4 rounded skeleton-shimmer" />
        <div className="w-1/2 h-3 rounded skeleton-shimmer" />
      </div>
      <div className="w-12 h-8 rounded skeleton-shimmer" />
    </div>
  );
}
