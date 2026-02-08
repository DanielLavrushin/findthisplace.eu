import { useQuery } from "@tanstack/react-query";

export interface NotFoundPost {
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
  tier: number;
  country_code?: string;
}

async function fetchNotFoundPosts(): Promise<NotFoundPost[]> {
  const res = await fetch("/api/posts/not-found");
  if (!res.ok) throw new Error("Failed to fetch not-found posts");
  return (await res.json()) ?? [];
}

export function useNotFoundPosts() {
  return useQuery({
    queryKey: ["posts", "not-found"],
    queryFn: fetchNotFoundPosts,
  });
}
