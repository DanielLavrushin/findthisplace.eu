import type { UserYear, YearLeader } from "./useUserYears";
import { pick } from "../../utils/pick";

/** Who was the best of the most years, and of which; a shared first place counts for each. */
export function mostYearsFirst(
  years: UserYear[],
): { leader: YearLeader; years: number[] } | undefined {
  const firsts = new Map<number, { leader: YearLeader; years: number[] }>();
  for (const y of years) {
    for (const l of y.top) {
      if (l.count !== y.top[0].count) break;
      const f = firsts.get(l.id) ?? { leader: l, years: [] };
      f.years.push(y.year);
      firsts.set(l.id, f);
    }
  }
  return pick([...firsts.values()], (a, b) => a.years.length > b.years.length);
}

/** The most anyone did in a single year; if it was equalled, whoever did it first. */
export function yearRecord(
  years: UserYear[],
): { leader: YearLeader; year: number } | undefined {
  const best = pick(
    years.filter((y) => y.top.length > 0),
    (a, b) => a.top[0].count > b.top[0].count || (a.top[0].count === b.top[0].count && a.year < b.year),
  );
  return best && { leader: best.top[0], year: best.year };
}

/** 2020, 2021, 2022, 2024 → "2020–2022, 2024"; a run of two stays two years. */
export function yearSpans(years: number[]): string {
  const sorted = [...years].sort((a, b) => a - b);
  const spans: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) spans.push(`${sorted[i]}–${sorted[j]}`);
    else spans.push(...sorted.slice(i, j + 1).map(String));
    i = j + 1;
  }
  return spans.join(", ");
}
