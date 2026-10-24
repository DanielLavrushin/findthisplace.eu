import { useQuery } from "@tanstack/react-query";
import type { NotFoundPost } from "../posts/useNotFoundPosts";

/** Another tag, to link to its page. */
export interface TagRef {
  /** as tagged on d3.ru, e.g. "saint petersburg" */
  tag: string;
  slug: string;
  /** a country's code, for its flag */
  code?: string;
  count: number;
}

/** An author or searcher on a tag's leaderboard. */
export interface TagUser {
  id: number;
  login: string;
  avatar_url?: string;
  count: number;
  tiers: number[];
  avg_search_time: number;
}

export interface TagDetail {
  tag: string;
  slug: string;
  /** set when the tag is a country */
  country?: string;
  code?: string;
  /** the country nearly all the places are in, when the tag is a place in one */
  parent?: TagRef;
  /** the places' other tags, the most used first */
  related: TagRef[];
  /** found posts, the latest find first */
  posts: NotFoundPost[];
  searchers: TagUser[];
  authors: TagUser[];
}

/** null for a tag no post has: nothing to retry */
async function fetchTagDetail(slug: string): Promise<TagDetail | null> {
  const res = await fetch(`/api/tags/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch tag: ${res.status}`);
  return res.json();
}

export function useTagDetail(slug: string) {
  return useQuery({
    queryKey: ["tag", slug],
    queryFn: () => fetchTagDetail(slug),
    enabled: slug !== "",
  });
}
