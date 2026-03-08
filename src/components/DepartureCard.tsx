import { useMemo } from 'react';
import { PTVDeparture } from '@/lib/ptv-api';
import { TransportBadge } from './TransportBadge';
import { cn } from '@/lib/utils';
import { Radio, Clock } from 'lucide-react';

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
  onTrackRoute,
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
    if (diffMins < 60) return `${diffMins} min`;
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hrs >= 24) {
      const days = Math.floor(hrs / 24);
      const remHrs = hrs % 24;
      if (remHrs === 0) return `${days}d`;
      return `${days}d ${remHrs}h`;
    }
    if (mins === 0) return `${hrs} hr`;
    return `${hrs}h ${mins}m`;
  }, [departureTime]);

  const timeStr = useMemo(() => {
    const dep = new Date(departureTime);
    return dep.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  }, [departureTime]);

  const isNow = countdown === 'Now';

  return (
    <button
      onClick={() => onTrackRoute?.()}
      className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/20 hover:shadow-sm transition-all text-left cursor-pointer"
    >
      {/* Route info */}
      <div className="flex-shrink-0">
        <TransportBadge routeType={routeType} showLabel={false} />
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
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{timeStr}</span>
          {departure.platform_number && (
            <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded font-medium">
              Plat. {departure.platform_number}
            </span>
          )}
        </div>
      </div>

      {/* Countdown + track */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {onTrackRoute && (
          <button
            onClick={(e) => { e.stopPropagation(); onTrackRoute(); }}
            className="p-2 rounded-lg hover:bg-accent transition-colors border border-border"
            aria-label="Track this route live"
            title="Track route"
          >
            <Radio className="w-4 h-4 text-realtime" />
          </button>
        )}
        <div className="text-right min-w-[52px]">
          <div
            className={cn(
              'text-lg font-bold tabular-nums leading-tight',
              isRealtime ? 'text-realtime animate-pulse-realtime' : 'text-scheduled',
              isNow && 'text-xl'
            )}
          >
            {countdown}
          </div>
          <div className={cn(
            'text-[10px] uppercase tracking-wider font-semibold',
            isRealtime ? 'text-realtime' : 'text-muted-foreground'
          )}>
            {isRealtime ? '● Live' : 'Sched'}
          </div>
        </div>
      </div>
    </button>
  );
}

export function DepartureCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border">
      <div className="w-8 h-6 rounded-full skeleton-shimmer" />
      <div className="flex-1 space-y-2">
        <div className="w-3/4 h-4 rounded skeleton-shimmer" />
        <div className="w-1/2 h-3 rounded skeleton-shimmer" />
      </div>
      <div className="w-14 h-10 rounded skeleton-shimmer" />
    </div>
  );
}
