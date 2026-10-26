import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Setting {
  name: string;
  value: unknown;
}

// Protected admin ID that cannot be removed; the server refuses it too
// (settings.SuperAdminId)
const PROTECTED_ADMIN_ID = 25377;

async function fetchSettings(): Promise<Setting[]> {
  const res = await fetch("/api/admin/settings");
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
  return (await res.json()) ?? [];
}

async function updateSetting(setting: Setting): Promise<void> {
  // Ensure protected admin ID is never removed from admin_ids
  if (setting.name === "admin_ids") {
    const ids = Array.isArray(setting.value) ? setting.value as number[] : [];
    if (!ids.includes(PROTECTED_ADMIN_ID)) {
      throw new Error(`Нельзя удалить защищённого администратора (ID: ${PROTECTED_ADMIN_ID})`);
    }
  }

  const res = await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(setting),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to update setting: ${res.status}`);
  }
}

// not ["settings"]: that's the footer's public subset
export function useSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: fetchSettings,
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSetting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
  });
}
