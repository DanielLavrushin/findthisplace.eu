import { useMemo } from "react";
import { Box, Tooltip, Typography, type SxProps, type Theme } from "@mui/material";
import type { NotFoundPost } from "../posts/useNotFoundPosts";
import { plural } from "../../utils/plural";

// a deep shade of the world map's green (WorldHeatmap), 4.6:1 on white
const BAR_COLOR = "#4e813b";
const MAX_LABELS = 6;

// in px: to sx, a width of 1 is 100%
const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  m: "-1px",
  p: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

/** How many of the country's places were set as puzzles each year. */
export default function PostsByYear({
  posts,
  height = 88,
  sx,
}: Readonly<{ posts: NotFoundPost[]; height?: number; sx?: SxProps<Theme> }>) {
  const years = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of posts) {
      if (!p.created_date) continue;
      const year = new Date(p.created_date).getFullYear();
      counts.set(year, (counts.get(year) ?? 0) + 1);
    }
    if (counts.size === 0) return [];
    const first = Math.min(...counts.keys());
    // up to now, so a country gone quiet shows it
    const last = Math.max(new Date().getFullYear(), ...counts.keys());
    // the quiet years too, so the axis runs evenly
    return Array.from({ length: last - first + 1 }, (_, i) => ({
      year: first + i,
      count: counts.get(first + i) ?? 0,
    }));
  }, [posts]);

  // a year or two of puzzles is a fact, not a history
  if (years.filter((y) => y.count > 0).length < 3) return null;

  const max = Math.max(...years.map((y) => y.count));
  const peak = years.findIndex((y) => y.count === max);
  const every = Math.ceil(years.length / MAX_LABELS);
  // every few years, and the last one, a full step clear of the one before
  const labelled = (i: number) =>
    i === years.length - 1 || (i % every === 0 && years.length - 1 - i >= every);

  return (
    <Box sx={[{ position: "relative", minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Typography variant="caption" color="text.secondary" component="h2">
        Загадано по годам
      </Typography>

      <Box aria-hidden sx={{ mt: 2.5 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "stretch",
            gap: "2px",
            height,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          {years.map((y, i) => (
            <Tooltip
              key={y.year}
              title={`${y.year}: ${y.count > 0 ? plural(y.count, "место") : "ни одного места"}`}
              placement="top"
              arrow
            >
              <Box
                sx={{
                  position: "relative",
                  flex: "1 1 0",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-end",
                  "&:hover > div": { filter: "brightness(1.15)" },
                }}
              >
                {i === peak && (
                  <Typography
                    variant="caption"
                    sx={{
                      position: "absolute",
                      bottom: `calc(${(y.count / max) * 100}% + 2px)`,
                      lineHeight: 1.2,
                      fontWeight: 700,
                    }}
                  >
                    {y.count}
                  </Typography>
                )}
                <Box
                  sx={{
                    width: "min(24px, 70%)",
                    height: `${(y.count / max) * 100}%`,
                    // so a single place still shows
                    minHeight: y.count > 0 ? 3 : 0,
                    bgcolor: BAR_COLOR,
                    borderRadius: "4px 4px 0 0",
                  }}
                />
              </Box>
            </Tooltip>
          ))}
        </Box>
        <Box sx={{ display: "flex", gap: "2px", mt: 0.5 }}>
          {years.map((y, i) => (
            // centred under its column even where the year is wider than it
            <Box
              key={y.year}
              sx={{ flex: "1 1 0", minWidth: 0, display: "flex", justifyContent: "center" }}
            >
              {labelled(i) && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1.4,
                  }}
                >
                  {y.year}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      <Box component="table" sx={visuallyHidden}>
        <caption>Загадано мест по годам</caption>
        <tbody>
          {years.map((y) => (
            <tr key={y.year}>
              <th scope="row">{y.year}</th>
              <td>{y.count}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
