import { useMemo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { UserPost } from "./useUserDetail";
import { countryCodeToFlag, getCountryName } from "../../utils/countries";
import { formatDuration } from "../../utils/formatDuration";
import { plural } from "../../utils/plural";

interface SearcherStatsProps {
  posts: UserPost[];
  avgSearchTime?: number;
}

interface StatCardProps {
  icon: string;
  value: string;
  label: string;
  sublabel?: string;
  gradient: string;
}

function StatCard({
  icon,
  value,
  label,
  sublabel,
  gradient,
}: Readonly<StatCardProps>) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        position: "relative",
        flex: 1,
        minWidth: 140,
        p: 2,
        borderRadius: 3,
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.7)",
        backdropFilter: "blur(10px)",
        border: "1px solid",
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        overflow: "hidden",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: isDark
            ? "0 8px 32px rgba(0,0,0,0.3)"
            : "0 8px 32px rgba(0,0,0,0.08)",
        },
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: gradient,
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Box sx={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "1.1rem",
              fontWeight: 800,
              lineHeight: 1.2,
              background: gradient,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {value}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.secondary",
              fontWeight: 500,
              mt: 0.25,
              lineHeight: 1.2,
            }}
          >
            {label}
          </Typography>
          {sublabel && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "text.disabled",
                fontSize: "0.7rem",
                lineHeight: 1.2,
              }}
            >
              {sublabel}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function formatSearchTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}сек.`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин.`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} ч.`;
  return formatDuration(seconds);
}

// Haversine formula to calculate distance between two coordinates in km
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
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
  if (km >= 1_000_000) {
    return `${(km / 1_000_000).toFixed(1)} млн. км`;
  }
  if (km >= 10_000) {
    return `${Math.round(km / 1000)} тыс. км`;
  }
  if (km >= 1000) {
    return `${km.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} км`;
  }
  return `${Math.round(km)} км`;
}

export default function SearcherStats({
  posts,
  avgSearchTime,
}: Readonly<SearcherStatsProps>) {
  const stats = useMemo(() => {
    const finderPosts = posts.filter((p) => p.role === "finder");
    if (finderPosts.length === 0) return null;

    // Country stats
    const countryCounts: Record<string, number> = {};
    finderPosts.forEach((p) => {
      if (p.country_code) {
        countryCounts[p.country_code] =
          (countryCounts[p.country_code] || 0) + 1;
      }
    });
    const countryEntries = Object.entries(countryCounts);
    const uniqueCountries = countryEntries.length;
    const favoriteCountry = countryEntries.sort((a, b) => b[1] - a[1])[0];

    // Time stats (search duration = found_date - created_date)
    const searchTimes: { post: UserPost; duration: number }[] = [];
    finderPosts.forEach((p) => {
      if (p.found_date && p.created_date) {
        const found = new Date(p.found_date).getTime();
        const created = new Date(p.created_date).getTime();
        const duration = (found - created) / 1000; // seconds
        if (duration > 0) {
          searchTimes.push({ post: p, duration });
        }
      }
    });

    const fastestSearch =
      searchTimes.length > 0
        ? searchTimes.reduce((min, curr) =>
            curr.duration < min.duration ? curr : min,
          )
        : null;
    const longestSearch =
      searchTimes.length > 0
        ? searchTimes.reduce((max, curr) =>
            curr.duration > max.duration ? curr : max,
          )
        : null;

    // First find
    const sortedByDate = [...finderPosts]
      .filter((p) => p.found_date)
      .sort(
        (a, b) =>
          new Date(a.found_date!).getTime() - new Date(b.found_date!).getTime(),
      );
    const firstFind = sortedByDate[0];

    // Rarest catch (highest tier)
    const rarestTier = Math.max(...finderPosts.map((p) => p.tier));

    // Total travel distance
    const postsWithCoords = finderPosts
      .filter(
        (p) =>
          p.latitude !== undefined &&
          p.longitude !== undefined &&
          p.latitude !== 0 &&
          p.longitude !== 0,
      )
      .sort(
        (a, b) =>
          new Date(a.found_date || 0).getTime() -
          new Date(b.found_date || 0).getTime(),
      );

    let totalDistance = 0;
    for (let i = 1; i < postsWithCoords.length; i++) {
      const prev = postsWithCoords[i - 1];
      const curr = postsWithCoords[i];
      totalDistance += haversineDistance(
        prev.latitude!,
        prev.longitude!,
        curr.latitude!,
        curr.longitude!,
      );
    }

    return {
      favoriteCountry,
      uniqueCountries,
      fastestSearch,
      longestSearch,
      firstFind,
      rarestTier,
      totalFinds: finderPosts.length,
      totalDistance,
    };
  }, [posts]);

  if (!stats || stats.totalFinds === 0) return null;

  const statCards: StatCardProps[] = [];

  // Favorite country
  if (stats.favoriteCountry) {
    const [code, count] = stats.favoriteCountry;
    statCards.push({
      icon: countryCodeToFlag(code),
      value: getCountryName(code),
      label: "Любимый регион",
      sublabel: plural(count, "находка"),
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    });
  }

  // Countries count
  if (stats.uniqueCountries > 1) {
    statCards.push({
      icon: "🌍",
      value: String(stats.uniqueCountries),
      label: "Стран",
      sublabel: "исследовано",
      gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    });
  }

  // Travel distance
  if (stats.totalDistance > 100) {
    statCards.push({
      icon: "✈️",
      value: formatDistance(stats.totalDistance),
      label: "Путь сыщика",
      sublabel: "между находками",
      gradient: "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)",
    });
  }

  // Average search time
  if (avgSearchTime && avgSearchTime > 0) {
    statCards.push({
      icon: "⏱️",
      value: formatDuration(avgSearchTime),
      label: "Среднее время",
      sublabel: "на поиск",
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    });
  }

  // Fastest search
  if (stats.fastestSearch) {
    statCards.push({
      icon: "⚡",
      value: formatSearchTime(stats.fastestSearch.duration),
      label: "Рекорд скорости",
      sublabel: "самый быстрый поиск",
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    });
  }

  // Longest search
  if (stats.longestSearch && stats.longestSearch !== stats.fastestSearch) {
    statCards.push({
      icon: "🏔️",
      value: formatSearchTime(stats.longestSearch.duration),
      label: "Эпичная охота",
      sublabel: "самый долгий поиск",
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    });
  }

  // First find
  if (stats.firstFind?.found_date) {
    const date = new Date(stats.firstFind.found_date);
    const monthYear = date.toLocaleDateString("ru-RU", {
      month: "short",
      year: "numeric",
    });
    statCards.push({
      icon: "🎯",
      value: monthYear,
      label: "Первая находка",
      sublabel: "начало пути",
      gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    });
  }

  // Rarest tier
  if (stats.rarestTier >= 3) {
    const tierLabels = [
      "Свежий",
      "Выдержанный",
      "Винтажный",
      "Редкий",
      "Легендарный",
    ];
    statCards.push({
      icon: stats.rarestTier === 4 ? "💎" : "✨",
      value: tierLabels[stats.rarestTier],
      label: "Редкий улов",
      sublabel: stats.rarestTier === 4 ? "5+ лет" : "2-5 лет",
      gradient:
        stats.rarestTier === 4
          ? "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)"
          : "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
    });
  }

  if (statCards.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="subtitle2"
        sx={{
          mb: 1.5,
          color: "text.secondary",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontSize: "0.7rem",
        }}
      >
        Статистика
      </Typography>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 1,
          "&::-webkit-scrollbar": { height: 6 },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(128,128,128,0.3)",
            borderRadius: 3,
          },
        }}
      >
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </Box>
    </Box>
  );
}
