import { ago } from "../../utils/ago";

/**
 * When someone was at it, for a row's details: "первая находка — в 2015
 * году, последняя — 3 дня назад". `noun` is "находка" or "загадка".
 */
export function activity(
  noun: string,
  count: number,
  first?: string,
  last?: string,
): string | undefined {
  if (!first || !last) return undefined;
  // a dash keeps to the word before it, as a line never starts with one
  if (count === 1) return `единственная ${noun} — ${ago(last)}`;
  return `первая ${noun} — в ${new Date(first).getFullYear()} году, последняя — ${ago(last)}`;
}

/** Whether a date falls within the last twelve months. */
export function withinYear(date?: string): boolean {
  return !!date && Date.now() - new Date(date).getTime() < 365 * 86400000;
}
