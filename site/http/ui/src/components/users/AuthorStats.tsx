import { useMemo } from "react";
import StatCards, { StatCardProps } from "../stats/StatCards";
import { UserPost } from "./useUserDetail";
import { countryCodeToFlag, getCountryName } from "../../utils/countries";
import { formatDuration } from "../../utils/formatDuration";
import { plural } from "../../utils/plural";

interface AuthorStatsProps {
  posts: UserPost[];
}

function formatSolveTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} сек.`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин.`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} ч.`;
  return formatDuration(seconds);
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km: number): string {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(1)} млн. км`;
  if (km >= 10_000) return `${Math.round(km / 1000)} тыс. км`;
  if (km >= 1000)
    return `${km.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} км`;
  return `${Math.round(km)} км`;
}

export default function AuthorStats({
  posts,
}: Readonly<AuthorStatsProps>) {
  const stats = useMemo(() => {
    const authorPosts = posts.filter((p) => p.role === "author");
    if (authorPosts.length === 0) return null;

    const solvedPosts = authorPosts.filter((p) => p.is_found);
    const unsolvedPosts = authorPosts.filter((p) => !p.is_found);

    // Country stats
    const countryCounts: Record<string, number> = {};
    authorPosts.forEach((p) => {
      if (p.country_code) {
        countryCounts[p.country_code] =
          (countryCounts[p.country_code] || 0) + 1;
      }
    });
    const countryEntries = Object.entries(countryCounts);
    const uniqueCountries = countryEntries.length;
    const favoriteCountry = countryEntries.sort((a, b) => b[1] - a[1])[0];

    // Solve time stats
    const solveTimes: { post: UserPost; duration: number }[] = [];
    solvedPosts.forEach((p) => {
      if (p.found_date && p.created_date) {
        const found = new Date(p.found_date).getTime();
        const created = new Date(p.created_date).getTime();
        const duration = (found - created) / 1000;
        if (duration > 0) solveTimes.push({ post: p, duration });
      }
    });

    const quickestCatch =
      solveTimes.length > 0
        ? solveTimes.reduce((min, curr) =>
            curr.duration < min.duration ? curr : min,
          )
        : null;
    const longestSurvivor =
      solveTimes.length > 0
        ? solveTimes.reduce((max, curr) =>
            curr.duration > max.duration ? curr : max,
          )
        : null;

    // Oldest unsolved mystery
    const now = Date.now();
    const oldestUnsolved =
      unsolvedPosts.length > 0
        ? unsolvedPosts.reduce((oldest, curr) => {
            const currAge = now - new Date(curr.created_date).getTime();
            const oldestAge = now - new Date(oldest.created_date).getTime();
            return currAge > oldestAge ? curr : oldest;
          })
        : null;
    const oldestUnsolvedAge = oldestUnsolved
      ? (now - new Date(oldestUnsolved.created_date).getTime()) / 1000
      : 0;

    // Unique finders & biggest fan
    const finderCounts: Record<string, number> = {};
    solvedPosts.forEach((p) => {
      if (p.found_by) {
        finderCounts[p.found_by] = (finderCounts[p.found_by] || 0) + 1;
      }
    });
    const uniqueFinders = Object.keys(finderCounts).length;
    const biggestFan = Object.entries(finderCounts).sort(
      (a, b) => b[1] - a[1],
    )[0];

    // First post date
    const sortedByCreated = [...authorPosts]
      .filter((p) => p.created_date)
      .sort(
        (a, b) =>
          new Date(a.created_date).getTime() -
          new Date(b.created_date).getTime(),
      );
    const firstPost = sortedByCreated[0];

    // Geographic reach (max distance between any two posts)
    const postsWithCoords = authorPosts.filter(
      (p) =>
        p.latitude !== undefined &&
        p.longitude !== undefined &&
        p.latitude !== 0 &&
        p.longitude !== 0,
    );
    let maxDistance = 0;
    for (let i = 0; i < postsWithCoords.length; i++) {
      for (let j = i + 1; j < postsWithCoords.length; j++) {
        const dist = haversineDistance(
          postsWithCoords[i].latitude!,
          postsWithCoords[i].longitude!,
          postsWithCoords[j].latitude!,
          postsWithCoords[j].longitude!,
        );
        if (dist > maxDistance) maxDistance = dist;
      }
    }

    return {
      favoriteCountry,
      uniqueCountries,
      quickestCatch,
      longestSurvivor,
      oldestUnsolved,
      oldestUnsolvedAge,
      biggestFan,
      uniqueFinders,
      firstPost,
      maxDistance,
      totalPosts: authorPosts.length,
      solvedCount: solvedPosts.length,
    };
  }, [posts]);

  if (!stats || stats.totalPosts === 0) return null;

  const statCards: StatCardProps[] = [];

  // Favorite country
  if (stats.favoriteCountry) {
    const [code, count] = stats.favoriteCountry;
    statCards.push({
      icon: countryCodeToFlag(code),
      value: getCountryName(code),
      label: "Любимая локация",
      sublabel: plural(count, "пост"),
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    });
  }

  // Countries covered
  if (stats.uniqueCountries > 1) {
    statCards.push({
      icon: "🌍",
      value: String(stats.uniqueCountries),
      label: "Стран",
      sublabel: "на карте",
      gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    });
  }

  // Geographic reach
  if (stats.maxDistance > 100) {
    statCards.push({
      icon: "📏",
      value: formatDistance(stats.maxDistance),
      label: "Размах географии",
      sublabel: "между постами",
      gradient: "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)",
    });
  }

  // Quickest catch
  if (stats.quickestCatch) {
    statCards.push({
      icon: "⚡",
      value: formatSolveTime(stats.quickestCatch.duration),
      label: "Быстрее всех нашли",
      sublabel: "рекорд скорости",
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    });
  }

  // Longest survivor
  if (
    stats.longestSurvivor &&
    stats.longestSurvivor !== stats.quickestCatch
  ) {
    statCards.push({
      icon: "🏔️",
      value: formatSolveTime(stats.longestSurvivor.duration),
      label: "Дольше всех искали",
      sublabel: "самый сложный пост",
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    });
  }

  // Oldest unsolved mystery (only if older than 30 days)
  if (stats.oldestUnsolved && stats.oldestUnsolvedAge > 86400 * 30) {
    statCards.push({
      icon: "🔮",
      value: formatDuration(stats.oldestUnsolvedAge),
      label: "Старейшая загадка",
      sublabel: "ещё не разгадана",
      gradient: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
    });
  }

  // Biggest fan (only if found more than 1 post)
  if (stats.biggestFan && stats.biggestFan[1] > 1) {
    statCards.push({
      icon: "👑",
      value: stats.biggestFan[0],
      label: "Фанат №1",
      sublabel: `нашёл ${plural(stats.biggestFan[1], "пост")}`,
      gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
    });
  }

  // Unique finders
  if (stats.uniqueFinders > 1) {
    statCards.push({
      icon: "🎯",
      value: String(stats.uniqueFinders),
      label: "Сыщиков",
      sublabel: "разгадали посты",
      gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    });
  }

  // First post
  if (stats.firstPost?.created_date) {
    const date = new Date(stats.firstPost.created_date);
    const monthYear = date.toLocaleDateString("ru-RU", {
      month: "short",
      year: "numeric",
    });
    statCards.push({
      icon: "📅",
      value: monthYear,
      label: "Первый пост",
      sublabel: "начало пути",
      gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    });
  }

  return <StatCards title="Интересные факты" cards={statCards} />;
}
