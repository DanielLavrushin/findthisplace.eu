import { Box, Typography } from "@mui/material";
import AuthorsList from "../components/authors/AuthorsList";
import AuthorHighlights from "../components/authors/AuthorHighlights";
import AuthorYears from "../components/authors/AuthorYears";
import { useAuthors } from "../components/authors/useAuthors";
import { useUserYears } from "../components/users/useUserYears";
import { plural } from "../utils/plural";

export default function AuthorsPage() {
  const { data: authors = [], isPending } = useAuthors();
  const { data: years = [], isPending: yearsPending } = useUserYears("authors");

  const total = authors.reduce((sum, a) => sum + a.author_posts_total, 0);
  const waiting = authors.reduce((sum, a) => sum + a.author_posts_nfound, 0);

  return (
    <Box>
      <Typography variant="h4">Авторы</Typography>
      <Typography color="text.secondary" sx={{ mb: 3, minHeight: "1.5em" }}>
        {!isPending &&
          // the last part wraps as a whole, never "ещё не" on one line and the rest on the next
          `${plural(authors.length, "автор")} · ${total.toLocaleString("ru-RU")} ${plural(total, "загадка", true)} · ещё не найдено: ${waiting}`}
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
        <AuthorYears years={years} loading={yearsPending} />
        <AuthorHighlights
          authors={authors}
          years={years}
          // a login is one long word: two cards a row on a phone cut it short
          columns={{ xs: "1fr", sm: "repeat(3, 1fr)", lg: "1fr" }}
          sx={{ mb: 0 }}
        />
      </Box>

      <AuthorsList authors={authors} loading={isPending} />
    </Box>
  );
}
