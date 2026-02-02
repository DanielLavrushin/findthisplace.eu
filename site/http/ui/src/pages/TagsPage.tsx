import { Box, Paper, Typography } from "@mui/material";
import PublicIcon from "@mui/icons-material/Public";
import PlaceIcon from "@mui/icons-material/Place";
import CountriesList from "../components/countries/CountriesList";
import CountryPodium from "../components/countries/CountryPodium";
import WorldHeatmap from "../components/countries/WorldHeatmap";
import { useCountries } from "../components/countries/useCountries";

function StatCard({
  icon,
  label,
  value,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
}>) {
  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        minWidth: 150,
        p: 2.5,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          bgcolor: "#fff3e0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f57c00",
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function TagsPage() {
  const { data: countries = [] } = useCountries();

  const totalPosts = countries.reduce((sum, c) => sum + c.count, 0);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Страны
      </Typography>

      {/* Map (left) + Stats & Podium (right) */}
      <Box
        sx={{
          display: "flex",
          gap: 3,
          mb: 3,
          flexWrap: "wrap",
          alignItems: "stretch",
        }}
      >
        <Box sx={{ flex: "1 1 55%", minWidth: 400, display: "flex" }}>
          <WorldHeatmap countries={countries} />
        </Box>
        <Box
          sx={{
            flex: "1 1 300px",
            minWidth: 300,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {/* Stats row */}
          <Box sx={{ display: "flex", gap: 2 }}>
            <StatCard
              icon={<PublicIcon sx={{ fontSize: 28 }} />}
              label="Стран"
              value={countries.length}
            />
            <StatCard
              icon={<PlaceIcon sx={{ fontSize: 28 }} />}
              label="Постов"
              value={totalPosts}
            />
          </Box>
          {/* Podium */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              pb: 0,
              overflow: "hidden",
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: 2,
                pt: 2,
                pb: 0,
              }}
            >
              ТОП Стран
            </Typography>
            <Box sx={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
              <CountryPodium countries={countries} />
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Full list with bars, 2 columns, starting from #4 */}
      <CountriesList showBars columns={2} startIndex={3} title="Все страны" />
    </Box>
  );
}
