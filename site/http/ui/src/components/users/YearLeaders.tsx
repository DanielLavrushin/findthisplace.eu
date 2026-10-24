import type { ReactNode } from "react";
import { Box, Paper, Skeleton, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  Bar,
  Breakdown,
  DetailsTooltip,
  Legend,
  LegendItem,
  places,
  Rank,
  Segment,
} from "../leaderboard/Leaderboard";
import type { UserYear, YearLeader } from "./useUserYears";

const ROW_HEIGHT = 44;

// the year, how much happened in it, its best three; on a phone only the best
const COLUMNS = {
  xs: "36px 96px minmax(0, 1fr)",
  sm: "44px minmax(110px, 0.7fr) repeat(3, minmax(0, 1fr))",
};

function Leader({
  leader,
  place,
  to,
}: Readonly<{ leader: YearLeader; place: number; to: string }>) {
  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        minWidth: 0,
        py: 0.5,
        px: 0.75,
        mx: -0.75,
        borderRadius: 2,
        color: "inherit",
        textDecoration: "none",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
      }}
    >
      <Rank rank={place} />
      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.9rem" }}>
        {leader.login}
      </Typography>
      <Typography
        sx={{ fontSize: "0.9rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
      >
        {leader.count}
      </Typography>
    </Box>
  );
}

interface YearLeadersProps {
  title: string;
  subtitle: string;
  years: UserYear[];
  loading: boolean;
  /** the profile a leader opens */
  profile: (id: number) => string;
  /** what the year's count is made of, for its bar */
  segments: (y: UserYear) => Segment[];
  /** the year in words, under its breakdown */
  note: (y: UserYear) => ReactNode;
  legend: LegendItem[];
}

/** Each year's best three, the latest year first, and how busy the year was. */
export default function YearLeaders({
  title,
  subtitle,
  years,
  loading,
  profile,
  segments,
  note,
  legend,
}: Readonly<YearLeadersProps>) {
  if (!loading && years.length === 0) return null;

  // the bars measure each year against the busiest
  const max = Math.max(0, ...years.map((y) => y.count));

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <Typography component="h2" sx={{ fontSize: "1.25rem", fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {subtitle}
      </Typography>

      <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {loading
          ? Array.from({ length: 10 }, (_, i) => (
              <li key={i}>
                <Skeleton variant="rounded" height={ROW_HEIGHT - 12} sx={{ my: "6px" }} />
              </li>
            ))
          : years.map((y, i) => {
              const ranks = places(y.top.map((l) => l.count));
              const parts = segments(y);
              return (
                <Box
                  component="li"
                  key={y.year}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: COLUMNS,
                    columnGap: { xs: 1.5, sm: 2 },
                    alignItems: "center",
                    minHeight: ROW_HEIGHT,
                    borderTop: i === 0 ? 0 : "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    component="h3"
                    sx={{
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: "text.secondary",
                    }}
                  >
                    {y.year}
                  </Typography>

                  <DetailsTooltip
                    title={<Breakdown segments={parts} note={note(y)} />}
                  >
                    {/* the bars line up into a chart of the years, each labelled at its end */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                      <Box
                        sx={{
                          flex: `0 0 calc((100% - 3.5em) * ${max ? y.count / max : 1})`,
                          // a quiet year still shows each of its parts, clear of the label
                          minWidth: "min-content",
                          // the bar's own top margin, which would lower it off the label's line
                          mt: -0.5,
                        }}
                      >
                        <Bar segments={parts} share={1} />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          color: "text.secondary",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {y.count.toLocaleString("ru-RU")}
                      </Typography>
                    </Box>
                  </DetailsTooltip>

                  {[0, 1, 2].map((p) => {
                    const leader = y.top[p];
                    return (
                      <Box
                        key={p}
                        sx={{
                          minWidth: 0,
                          display: p === 0 ? "block" : { xs: "none", sm: "block" },
                        }}
                      >
                        {leader && (
                          <Leader leader={leader} place={ranks[p]} to={profile(leader.id)} />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
      </Box>

      <Legend items={legend} />
    </Paper>
  );
}
