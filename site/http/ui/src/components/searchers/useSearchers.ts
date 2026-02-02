import { useQuery } from "@tanstack/react-query";

export interface Searcher {
  id: number;
  login: string;
  avatar_url: string;
  found_tiers_total: number;
  found_tier0: number;
  found_tier1: number;
  found_tier2: number;
  found_tier3: number;
  found_tier4: number;
  avg_search_time: number;
}

async function fetchSearchers(limit?: number): Promise<Searcher[]> {
  const url = limit ? `/api/users/searchers/${limit}` : "/api/users/searchers";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch searchers: ${res.status}`);
  return (await res.json()) ?? [];
}

export function useSearchers(limit?: number) {
  return useQuery({
    queryKey: ["searchers", limit],
    queryFn: () => fetchSearchers(limit),
  });
}
