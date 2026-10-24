import { useQuery } from "@tanstack/react-query";

export interface UserPost {
  id: number;
  title: string;
  main_image_url: string;
  user_id?: number;
  username: string;
  gender: string;
  created_date: string;
  is_found: boolean;
  found_date?: string;
  found_by_id?: number;
  found_by?: string;
  longitude?: number;
  latitude?: number;
  tier: number;
  role: "author" | "finder";
  country_code?: string;
}

export interface UserDetail {
  id: number;
  login: string;
  avatar_url?: string;
  author_posts_found: number;
  author_posts_total: number;
  author_posts_nfound: number;
  avg_author_time: number;
  found_tiers_total: number;
  found_tier0: number;
  found_tier1: number;
  found_tier2: number;
  found_tier3: number;
  found_tier4: number;
  avg_search_time: number;
  posts: UserPost[];
}

/** null for no such user: nothing to retry */
async function fetchUserDetail(ref: string): Promise<UserDetail | null> {
  const res = await fetch(`/api/users/${encodeURIComponent(ref)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  const user = await res.json();
  // "searchers" and "authors" are the lists' addresses, not anyone's nickname
  return Array.isArray(user) ? null : user;
}

/** A profile by id or by nickname: "25377" and "Via_Lactea" are the same page. */
export function useUserDetail(ref: string) {
  return useQuery({
    queryKey: ["user", ref],
    queryFn: () => fetchUserDetail(ref),
    enabled: ref !== "",
  });
}
