import { useQuery } from "@tanstack/react-query";

export interface NotFoundPost {
  id: number;
  title: string;
  main_image_url: string;
  username: string;
  gender: string;
  created_date: string;
  is_found: boolean;
  tier: number;
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
