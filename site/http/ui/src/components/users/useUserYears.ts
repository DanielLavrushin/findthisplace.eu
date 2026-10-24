import { useQuery } from "@tanstack/react-query";

/** A searcher or author among a year's best. */
export interface YearLeader {
  id: number;
  login: string;
  avatar_url?: string;
  count: number;
}

/** A year of the game, the latest first. */
export interface UserYear {
  year: number;
  /** places found that year, or set as puzzles */
  count: number;
  /** the searchers' year: its finds by tier, lowest first */
  tiers?: number[];
  /** the authors' year: its puzzles no one has found yet */
  nfound?: number;
  /** how many searchers found anything, or authors set anything */
  users: number;
  /** the most first; of equals, the one who got there first */
  top: YearLeader[];
}

async function fetchUserYears(role: "searchers" | "authors"): Promise<UserYear[]> {
  const res = await fetch(`/api/users/${role}/years`);
  if (!res.ok) throw new Error(`Failed to fetch ${role} by year: ${res.status}`);
  return (await res.json()) ?? [];
}

export function useUserYears(role: "searchers" | "authors") {
  return useQuery({
    queryKey: ["years", role],
    queryFn: () => fetchUserYears(role),
  });
}
