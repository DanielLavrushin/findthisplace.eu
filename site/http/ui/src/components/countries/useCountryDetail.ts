import { useQuery } from "@tanstack/react-query";
import type { NotFoundPost } from "../posts/useNotFoundPosts";

/** An author or searcher on a country's leaderboard. */
export interface CountryUser {
  id: number;
  login: string;
  avatar_url?: string;
  count: number;
  tiers: number[];
  avg_search_time: number;
}

export interface CountryDetail {
  country: string;
  code: string;
  slug: string;
  /** found posts, the latest find first */
  posts: NotFoundPost[];
  searchers: CountryUser[];
  authors: CountryUser[];
}

/** null for a country there is no such tag for: nothing to retry */
async function fetchCountryDetail(slug: string): Promise<CountryDetail | null> {
  const res = await fetch(`/api/tags/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch country: ${res.status}`);
  return res.json();
}

export function useCountryDetail(slug: string) {
  return useQuery({
    queryKey: ["country", slug],
    queryFn: () => fetchCountryDetail(slug),
    enabled: slug !== "",
  });
}
