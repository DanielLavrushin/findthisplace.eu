import { countryName } from "../posts/cardUtils";

/**
 * How a tag reads on the page. d3.ru keeps tags lowercase: a country takes
 * its Russian name, an English place name its capitals back ("new york" →
 * "New York"), anything else just a capital first letter ("нарисованное").
 */
export function tagName(tag: string, code?: string): string {
  if (code) return countryName(code);
  if (/^[\x20-\x7e]+$/.test(tag)) {
    return tag.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  }
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}
