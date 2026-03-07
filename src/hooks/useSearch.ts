import { useState, useCallback, useRef } from 'react';
import { searchStopsAndRoutes, PTVSearchResult } from '@/lib/ptv-api';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PTVSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (term: string) => {
    setQuery(term);
    if (term.length < 2) {
      setResults(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchStopsAndRoutes(term);
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults(null);
  }, []);

  return { query, results, loading, search, clearSearch };
}
