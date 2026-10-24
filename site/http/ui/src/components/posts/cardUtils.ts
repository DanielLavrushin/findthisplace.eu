import { formatDuration } from "../../utils/formatDuration";
import tire0marker from "../../../assets/tire0marker.png";
import tire1marker from "../../../assets/tire1marker.png";
import tire2marker from "../../../assets/tire2marker.png";
import tire3marker from "../../../assets/tire3marker.png";
import tire4marker from "../../../assets/tire4marker.png";

export const tierMarkers = [
  tire0marker,
  tire1marker,
  tire2marker,
  tire3marker,
  tire4marker,
];

export const tierNames = ["Новая", "Бронза", "Серебро", "Золото", "Эпическая"];

export function postUrl(id: number): string {
  return `https://findthisplace.d3.ru/${id}`;
}

export function tornMask(seed: number): string {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='4' seed='${seed}'/%3E%3CfeDisplacementMap in='SourceGraphic' scale='15'/%3E%3C/filter%3E%3Crect width='200' height='200' rx='8' filter='url(%23f)' fill='white'/%3E%3C/svg%3E")`;
}

// same flag set react-country-flag renders elsewhere, but as a URL so the
// stamp's foil layers can reuse the image as a background
export function flagUrl(countryCode: string): string {
  return `https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/${countryCode.toLowerCase()}.svg`;
}

export function daysBetween(fromStr: string, toStr?: string): number {
  const from = new Date(fromStr);
  const to = toStr ? new Date(toStr) : new Date();
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

let regionNames: Intl.DisplayNames | null | undefined;

/** Country name in Russian, e.g. "kz" → "Казахстан". */
export function countryName(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["ru"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** How long a puzzle took to solve: minutes and hours for quick ones. */
export function formatSolveTime(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
  }
  if (hours < 72) {
    const rest = hours % 24;
    const days = Math.floor(hours / 24);
    return rest > 0 ? `${days} дн. ${rest} ч` : `${days} дн.`;
  }
  return formatDuration(seconds);
}
