import { useQuery } from "@tanstack/react-query";

export interface Author {
  id: number;
  login: string;
  avatar_url?: string;
  author_posts_found: number;
  author_posts_total: number;
  author_posts_nfound: number;
  avg_author_time: number;
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
