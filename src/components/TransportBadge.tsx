import { ROUTE_TYPE_COLORS, ROUTE_TYPE_LABELS } from '@/lib/ptv-api';
import { cn } from '@/lib/utils';

interface TransportBadgeProps {
  routeType: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function TransportBadge({ routeType, size = 'sm', className }: TransportBadgeProps) {
  const color = ROUTE_TYPE_COLORS[routeType] || 'train';
  const label = ROUTE_TYPE_LABELS[routeType] || 'Unknown';

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        color === 'train' && 'bg-train text-train-foreground',
        color === 'tram' && 'bg-tram text-tram-foreground',
        color === 'bus' && 'bg-bus text-bus-foreground',
        className
      )}
    >
      {label}
    </span>
  );
}
