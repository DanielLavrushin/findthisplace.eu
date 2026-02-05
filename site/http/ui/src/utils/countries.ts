import countriesData from "../../../handler/countries.json";

const countries: Record<string, string> = countriesData;

export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function getCountryName(code: string): string {
  if (!code) return "Unknown";
  return countries[code.toUpperCase()] || code.toUpperCase();
}
