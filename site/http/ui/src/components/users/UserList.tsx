import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Box,
  Button,
  InputAdornment,
  Paper,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import {
  LeaderboardRow,
  Legend,
  LegendItem,
  places,
  Segment,
  UserAvatar,
} from "../leaderboard/Leaderboard";

// three columns of twenty: the leaders, before the long tail
const PAGE_SIZE = 60;

export interface ListUser {
  id: number;
  login: string;
  avatar_url?: string;
}

/** One way to rank the users: by what, and how the order breaks ties. */
export interface Ranking<U> {
  key: string;
  /** on its toggle */
  label: string;
  /** what the number in each row counts */
  subtitle: string;
  /** a user with none of it is not on this board */
  value: (u: U) => number;
  /** of equal values, which comes first; by name otherwise */
  tiebreak?: (a: U, b: U) => number;
  /** when the search finds no one on this board */
  empty: string;
}

// "Ёжик" is found as "ежик", as ё is typed as е more often than not
function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

interface UserListProps<U extends ListUser> {
  title: string;
  users: U[];
  loading: boolean;
  rankings: Ranking<U>[];
  /**
   * a row's bar: what the user's finds or puzzles are made of, the same
   * whichever ranking is on, and across the whole row as on the main page
   */
  segments: (u: U) => Segment[];
  legend: LegendItem[];
  /** the profile a row opens */
  profile: (id: number) => string;
  details: (u: U) => ReactNode;
}

/** Everyone, ranked and searchable, in columns that read down like a ranking. */
export default function UserList<U extends ListUser>({
  title,
  users,
  loading,
  rankings,
  segments,
  legend,
  profile,
  details,
}: Readonly<UserListProps<U>>) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState(rankings[0].key);
  const [expanded, setExpanded] = useState(false);

  const ranking = rankings.find((r) => r.key === order) ?? rankings[0];

  const ranked = useMemo(() => {
    const scored = users
      .map((u) => ({ u, value: ranking.value(u) }))
      .filter((x) => x.value > 0)
      .sort(
        (a, b) =>
          b.value - a.value ||
          (ranking.tiebreak?.(a.u, b.u) ?? 0) ||
          a.u.login.localeCompare(b.u.login, "ru"),
      );
    const ranks = places(scored.map((x) => x.value));
    return scored.map((x, i) => ({ ...x, rank: ranks[i] }));
  }, [users, ranking]);

  // the field keeps up with typing while a long list catches up
  const deferredQuery = useDeferredValue(query);
  const shown = useMemo(() => {
    const q = normalize(deferredQuery.trim());
    return q ? ranked.filter((x) => normalize(x.u.login).includes(q)) : ranked;
  }, [ranked, deferredQuery]);

  const visible = expanded ? shown : shown.slice(0, PAGE_SIZE);
  const lastRank = ranked[ranked.length - 1]?.rank ?? 0;

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
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ranking.subtitle}
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Найти по нику"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputProps={{ "aria-label": "Найти по нику" }}
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
          value={ranking.key}
          onChange={(_, v: string | null) => {
            if (v) setOrder(v);
          }}
          aria-label="Рейтинг"
        >
          {rankings.map((r) => (
            <ToggleButton key={r.key} value={r.key}>
              {r.label}
            </ToggleButton>
          ))}
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
          ...(lastRank >= 100 && { "--rank-width": "32px" }),
        }}
      >
        {loading
          ? Array.from({ length: 12 }, (_, i) => (
              <li key={i}>
                <Skeleton variant="rounded" height={32} sx={{ my: "6px" }} />
              </li>
            ))
          : visible.map(({ u, value, rank }) => (
              <LeaderboardRow
                key={u.id}
                rank={rank}
                to={profile(u.id)}
                avatar={<UserAvatar src={u.avatar_url} login={u.login} />}
                name={u.login}
                value={value}
                segments={segments(u)}
                details={details(u)}
              />
            ))}
      </Box>

      {!loading && shown.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
          {ranking.empty}
        </Typography>
      )}

      {visible.length < shown.length && (
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Button
            variant="outlined"
            // hundreds of rows: the page stays responsive while they render
            onClick={() => startTransition(() => setExpanded(true))}
          >
            Показать всех
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            показано {visible.length} из {shown.length}
          </Typography>
        </Box>
      )}

      <Legend items={legend} />
    </Paper>
  );
}
