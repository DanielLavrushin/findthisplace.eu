import { Box, Typography } from "@mui/material";
import CountriesList from "../components/countries/CountriesList";
import CountryHighlights from "../components/countries/CountryHighlights";
import WorldHeatmap from "../components/countries/WorldHeatmap";
import { useCountries } from "../components/countries/useCountries";
import { plural } from "../utils/plural";

export default function TagsPage() {
  const { data: countries = [], isPending } = useCountries();

  const total = countries.reduce((sum, c) => sum + c.count, 0);

  return (
    <Box>
      <Typography variant="h4">Страны</Typography>
      <Typography color="text.secondary" sx={{ mb: 3, minHeight: "1.5em" }}>
        {!isPending &&
          `${plural(countries.length, "страна")} · ${total.toLocaleString("ru-RU")} ${plural(total, "место", true)} найдено`}
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
        <WorldHeatmap countries={countries} />
        <CountryHighlights
          countries={countries}
          columns={{ xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", lg: "1fr" }}
          sx={{ mb: 0 }}
        />
      </Box>

      <CountriesList countries={countries} loading={isPending} />
    </Box>
  );
}
