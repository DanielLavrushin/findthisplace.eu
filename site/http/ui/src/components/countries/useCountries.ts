import { useQuery } from "@tanstack/react-query";

export interface Country {
  country: string;
  code: string;
  count: number;
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
