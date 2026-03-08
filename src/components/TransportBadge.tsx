import { ROUTE_TYPE_COLORS, ROUTE_TYPE_LABELS } from '@/lib/ptv-api';
import { cn } from '@/lib/utils';
import { TrainFront, TramFront, Bus } from 'lucide-react';

interface TransportBadgeProps {
  routeType: number;
  size?: 'sm' | 'md';
  className?: string;
  showLabel?: boolean;
}

const TRANSPORT_ICONS: Record<string, typeof TrainFront> = {
  train: TrainFront,
  tram: TramFront,
  bus: Bus,
};

export function TransportBadge({ routeType, size = 'sm', className, showLabel = true }: TransportBadgeProps) {
  const color = ROUTE_TYPE_COLORS[routeType] || 'train';
  const label = ROUTE_TYPE_LABELS[routeType] || 'Unknown';
  const Icon = TRANSPORT_ICONS[color] || TrainFront;

  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        color === 'train' && 'bg-train text-train-foreground',
        color === 'tram' && 'bg-tram text-tram-foreground',
        color === 'bus' && 'bg-bus text-bus-foreground',
        className
      )}
    >
      <Icon size={iconSize} strokeWidth={2.5} />
      {showLabel && label}
    </span>
  );
}

/** Standalone icon without badge background */
export function TransportIcon({ routeType, className, size = 16 }: { routeType: number; className?: string; size?: number }) {
  const color = ROUTE_TYPE_COLORS[routeType] || 'train';
  const Icon = TRANSPORT_ICONS[color] || TrainFront;

  return (
    <Icon
      size={size}
      strokeWidth={2}
      className={cn(
        color === 'train' && 'text-train',
        color === 'tram' && 'text-tram',
        color === 'bus' && 'text-bus',
        className
      )}
    />
  );
}
