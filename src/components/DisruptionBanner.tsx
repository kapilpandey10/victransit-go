import { PTVDisruption } from '@/lib/ptv-api';
import { AlertTriangle } from 'lucide-react';

interface DisruptionBannerProps {
  disruptions: PTVDisruption[];
}

export function DisruptionBanner({ disruptions }: DisruptionBannerProps) {
  if (disruptions.length === 0) return null;

  return (
    <div className="space-y-2">
      {disruptions.slice(0, 3).map((d) => (
        <div
          key={d.disruption_id}
          className="flex items-start gap-2 p-3 rounded-lg bg-disruption/10 border border-disruption/20"
        >
          <AlertTriangle className="w-4 h-4 text-disruption flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground line-clamp-2">{d.title}</p>
            {d.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {d.description.replace(/<[^>]*>/g, '')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
