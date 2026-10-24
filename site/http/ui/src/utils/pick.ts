/** The item none of the others is better than; undefined for no items. */
export function pick<T>(items: T[], better: (a: T, b: T) => boolean): T | undefined {
  return items.reduce<T | undefined>(
    (best, item) => (best === undefined || better(item, best) ? item : best),
    undefined,
  );
}
