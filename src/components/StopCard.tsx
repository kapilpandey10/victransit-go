import { PTVStop } from '@/lib/ptv-api';
import { TransportBadge, TransportIcon } from './TransportBadge';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { Star, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StopCardProps {
  stop: PTVStop;
  onClick: () => void;
  compact?: boolean;
}

export function StopCard({ stop, onClick, compact }: StopCardProps) {
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore();
  const fav = isFavorite(stop.stop_id, stop.route_type);

  const toggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fav) {
      removeFavorite(stop.stop_id, stop.route_type);
    } else {
      addFavorite({
        stopId: stop.stop_id,
        stopName: stop.stop_name,
        routeType: stop.route_type,
        latitude: stop.stop_latitude,
        longitude: stop.stop_longitude,
      });
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all text-left group',
        compact ? 'p-2.5' : 'p-3.5'
      )}
    >
      <div className="flex-shrink-0">
        <TransportBadge routeType={stop.route_type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground truncate">{stop.stop_name}</div>
        {stop.stop_distance !== undefined && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {stop.stop_distance < 1000
              ? `${Math.round(stop.stop_distance)}m away`
              : `${(stop.stop_distance / 1000).toFixed(1)}km away`}
          </div>
        )}
      </div>
      <button
        onClick={toggleFavorite}
        className="p-1.5 rounded-full hover:bg-accent transition-colors"
        aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star
          className={cn(
            'w-4 h-4 transition-colors',
            fav ? 'fill-bus text-bus' : 'text-muted-foreground'
          )}
        />
      </button>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}

export function StopCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border">
      <div className="w-16 h-6 rounded-full skeleton-shimmer" />
      <div className="flex-1 space-y-2">
        <div className="w-2/3 h-4 rounded skeleton-shimmer" />
        <div className="w-1/3 h-3 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}
