import { useQuery } from "@tanstack/react-query";
import { COUNT_COLOR, LegendItem, Segment } from "../leaderboard/Leaderboard";

export interface Author {
  id: number;
  login: string;
  avatar_url?: string;
  author_posts_found: number;
  author_posts_total: number;
  author_posts_nfound: number;
  avg_author_time: number;
  first_post?: string;
  last_post?: string;
}

export const FOUND: LegendItem = {
  label: "найдены",
  color: COUNT_COLOR,
  dotted: true,
};
export const NOT_FOUND: LegendItem = {
  label: "не найдены",
  color: "#d9761a",
  hint: "ещё ждут своего часа",
};

/** Puzzles split into the found and those still waiting, as a row's bar. */
export function puzzleSegments(found: number, nfound: number): Segment[] {
  return [
    { ...FOUND, value: found },
    { ...NOT_FOUND, value: nfound },
  ];
}

async function fetchAuthors(limit?: number): Promise<Author[]> {
  const url = limit ? `/api/users/authors/${limit}` : "/api/users/authors";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch authors: ${res.status}`);
  return (await res.json()) ?? [];
}

export function useAuthors(limit?: number) {
  return useQuery({
    queryKey: ["authors", limit],
    queryFn: () => fetchAuthors(limit),
  });
}
