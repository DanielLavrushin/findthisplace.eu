import { useQuery } from "@tanstack/react-query";

export interface ProblematicPost {
  id: number;
  title: string;
  main_image_url: string;
  username: string;
  gender: string;
  created_date: string;
  is_found: boolean;
  tier: number;
  latitude?: number;
  longitude?: number;
  found_by_id?: number;
  found_by?: string;
  found_date?: string;
}

async function fetchProblematicPosts(): Promise<ProblematicPost[]> {
  const res = await fetch("/api/admin/problematic-posts");
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Нет доступа");
    }
    throw new Error("Не удалось загрузить проблемные посты");
  }
  return (await res.json()) ?? [];
}

export function useProblematicPosts() {
  return useQuery({
    queryKey: ["admin", "problematic-posts"],
    queryFn: fetchProblematicPosts,
  });
}
