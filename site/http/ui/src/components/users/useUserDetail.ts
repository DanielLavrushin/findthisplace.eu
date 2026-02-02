import { useQuery } from "@tanstack/react-query";

export interface UserPost {
  id: number;
  title: string;
  main_image_url: string;
  username: string;
  gender: string;
  created_date: string;
  is_found: boolean;
  found_date?: string;
  longitude?: number;
  latitude?: number;
  tier: number;
  role: "author" | "finder";
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

async function fetchUserDetail(id: number): Promise<UserDetail> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json();
}

export function useUserDetail(id: number) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => fetchUserDetail(id),
    enabled: id > 0,
  });
}
