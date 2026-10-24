import { Box, Typography } from "@mui/material";
import SearchersList from "../components/searchers/SearchersList";
import SearcherHighlights from "../components/searchers/SearcherHighlights";
import SearcherYears from "../components/searchers/SearcherYears";
import { useSearchers } from "../components/searchers/useSearchers";
import { useUserYears } from "../components/users/useUserYears";
import { plural } from "../utils/plural";

export default function SearchersPage() {
  const { data: searchers = [], isPending } = useSearchers();
  const { data: years = [], isPending: yearsPending } = useUserYears("searchers");

  const total = searchers.reduce((sum, s) => sum + s.found_tiers_total, 0);

  return (
    <Box>
      <Typography variant="h4">Сыщики</Typography>
      <Typography color="text.secondary" sx={{ mb: 3, minHeight: "1.5em" }}>
        {!isPending &&
          `${plural(searchers.length, "сыщик")} · ${total.toLocaleString("ru-RU")} ${plural(total, "место", true)} найдено`}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 2fr) minmax(0, 1fr)" },
          gap: 3,
          mb: 3,
          alignItems: "start",
        }}
      >
        <SearcherYears years={years} loading={yearsPending} />
        <SearcherHighlights
          searchers={searchers}
          years={years}
          // a login is one long word: two cards a row on a phone cut it short
          columns={{ xs: "1fr", sm: "repeat(3, 1fr)", lg: "1fr" }}
          sx={{ mb: 0 }}
        />
      </Box>

      <SearchersList searchers={searchers} loading={isPending} />
    </Box>
  );
}
