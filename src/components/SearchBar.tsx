import { Search, X, Loader2 } from 'lucide-react';
import { PTVStop, PTVRoute } from '@/lib/ptv-api';
import { TransportBadge } from './TransportBadge';

interface SearchBarProps {
  query: string;
  onSearch: (term: string) => void;
  onClear: () => void;
  loading: boolean;
  results: { stops: PTVStop[]; routes: PTVRoute[] } | null;
  onStopSelect: (stop: PTVStop) => void;
  onRouteSelect: (route: PTVRoute) => void;
}

export function SearchBar({
  query,
  onSearch,
  onClear,
  loading,
  results,
  onStopSelect,
  onRouteSelect,
}: SearchBarProps) {
  const showResults = results && (results.stops.length > 0 || results.routes.length > 0);

  return (
    <div className="relative w-full">
      <div className="relative flex items-center bg-card/95 backdrop-blur-md rounded-xl shadow-lg border border-border overflow-hidden">
        <Search className="w-4 h-4 text-muted-foreground ml-3 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search stops or routes..."
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          aria-label="Search stops or routes"
        />
        {loading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin mr-2" />}
        {query && (
          <button onClick={onClear} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full mt-1.5 inset-x-0 z-50 bg-card/98 backdrop-blur-md rounded-xl shadow-xl border border-border max-h-80 overflow-y-auto">
          {results.routes.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1.5 font-semibold">
                Routes
              </p>
              {results.routes.slice(0, 5).map((route) => (
                <button
                  key={route.route_id}
                  onClick={() => {
                    onRouteSelect(route);
                    onClear();
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <TransportBadge routeType={route.route_type} showLabel={false} />
                  {route.route_number && (
                    <span className="font-bold text-sm text-foreground">
                      {route.route_number}
                    </span>
                  )}
                  <span className="text-sm text-foreground truncate">{route.route_name}</span>
                </button>
              ))}
            </div>
          )}

          {results.stops.length > 0 && (
            <div className="p-2 border-t border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-1.5 font-semibold">
                Stops
              </p>
              {results.stops.slice(0, 8).map((stop) => (
                <button
                  key={`${stop.stop_id}-${stop.route_type}`}
                  onClick={() => {
                    onStopSelect(stop);
                    onClear();
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <TransportBadge routeType={stop.route_type} showLabel={false} />
                  <span className="text-sm text-foreground truncate">{stop.stop_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
