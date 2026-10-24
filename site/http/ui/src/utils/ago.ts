const relative = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });

/** "сегодня", "3 дня назад", "в прошлом месяце", "2 года назад" */
export function ago(date: string): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 30) return relative.format(-days, "day");
  if (days < 365) return relative.format(-Math.floor(days / 30), "month");
  return relative.format(-Math.floor(days / 365), "year");
}
