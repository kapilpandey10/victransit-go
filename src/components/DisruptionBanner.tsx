import { PTVDisruption } from '@/lib/ptv-api';
import { TransportIcon } from './TransportBadge';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface DisruptionBannerProps {
  disruptions: PTVDisruption[];
}

export function DisruptionBanner({ disruptions }: DisruptionBannerProps) {
  if (disruptions.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No current disruptions</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {disruptions.slice(0, 10).map((d) => (
        <div
          key={d.disruption_id}
          className="flex items-start gap-2.5 p-3.5 rounded-xl bg-disruption/8 border border-disruption/15"
        >
          <AlertTriangle className="w-4 h-4 text-disruption flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground line-clamp-2">{d.title}</p>
            {d.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {d.description.replace(/<[^>]*>/g, '')}
              </p>
            )}
            {d.routes && d.routes.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {d.routes.slice(0, 4).map((r) => (
                  <span key={r.route_id} className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    <TransportIcon routeType={r.route_type} size={10} />
                    {r.route_number || r.route_name}
                  </span>
                ))}
              </div>
            )}
            {d.url && (
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary mt-1.5 hover:underline"
              >
                More info <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
