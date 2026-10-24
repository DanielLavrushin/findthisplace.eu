import { useQuery } from "@tanstack/react-query";

export interface Country {
  /** the d3.ru tag, e.g. "France" */
  country: string;
  code: string;
  slug: string;
  count: number;
  /** finds by tier, lowest first */
  tiers: number[];
  authors: number;
  searchers: number;
  avg_search_time: number;
  first_found?: string;
  last_found?: string;
  found_last_year: number;
}

async function fetchCountries(): Promise<Country[]> {
  const res = await fetch("/api/tags");
  if (!res.ok) throw new Error(`Failed to fetch countries: ${res.status}`);
  return (await res.json()) ?? [];
}

export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: fetchCountries,
  });
}
