import { useMemo, useState } from "react";
import {
  Box,
  InputAdornment,
  Paper,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import Flag from "./Flag";
import { Country } from "./useCountries";
import {
  Breakdown,
  LeaderboardRow,
  Legend,
  TIERS,
  tierSegments,
} from "../leaderboard/Leaderboard";
import { countryName } from "../posts/cardUtils";
import { formatDuration } from "../../utils/formatDuration";
import { plural } from "../../utils/plural";

type Order = "count" | "name";

// "Россия", "russia" and "ru" all find Russia; ё is typed as е more often than not
function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

interface CountriesListProps {
  countries: Country[];
  loading: boolean;
}

export default function CountriesList({
  countries,
  loading,
}: Readonly<CountriesListProps>) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<Order>("count");

  const named = useMemo(
    () => countries.map((c) => ({ ...c, name: countryName(c.code) })),
    [countries],
  );

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    const found = q
      ? named.filter((c) =>
          [c.name, c.country, c.code].some((s) => normalize(s).includes(q)),
        )
      : named;
    return order === "name"
      ? [...found].sort((a, b) => a.name.localeCompare(b.name, "ru"))
      : found;
  }, [named, query, order]);

  // bars keep the leader's scale while the list is searched
  const max = Math.max(0, ...countries.map((c) => c.count));

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: 2,
          rowGap: 1.5,
          mb: 2,
        }}
      >
        <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
          <Typography component="h2" sx={{ fontSize: "1.25rem", fontWeight: 700 }}>
            Все страны
          </Typography>
          <Typography variant="body2" color="text.secondary">
            сколько мест в каждой и как долго их искали
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Найти страну"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputProps={{ "aria-label": "Найти страну" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flex: { xs: "1 1 100%", sm: "0 1 220px" } }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={order}
          onChange={(_, v: Order | null) => {
            if (v) setOrder(v);
          }}
          aria-label="Порядок стран"
        >
          <ToggleButton value="count">по числу мест</ToggleButton>
          <ToggleButton value="name">по алфавиту</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box
        component="ol"
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
          // down each column, as a ranking reads
          columnCount: { xs: 1, sm: 2, lg: 3 },
          columnGap: 4,
          "& > li": { breakInside: "avoid" },
        }}
      >
        {loading
          ? Array.from({ length: 12 }, (_, i) => (
              <li key={i}>
                <Skeleton variant="rounded" height={32} sx={{ my: "6px" }} />
              </li>
            ))
          : shown.map((c) => {
              const segments = tierSegments(c.tiers);
              return (
                <LeaderboardRow
                  key={c.code}
                  to={`/tags/${c.slug}`}
                  avatar={<Flag code={c.code} />}
                  name={c.name}
                  value={c.count}
                  max={max}
                  segments={segments}
                  details={
                    <Breakdown
                      segments={segments}
                      note={[
                        `${plural(c.authors, "автор")} · ${plural(c.searchers, "сыщик")}`,
                        c.avg_search_time > 0 &&
                          `в среднем на поиск: ${formatDuration(c.avg_search_time)}`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    />
                  }
                />
              );
            })}
      </Box>

      {!loading && shown.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          Такой страны в списке нет: возможно, там ещё ничего не загадано
        </Typography>
      )}

      <Legend items={TIERS} />
    </Paper>
  );
}
