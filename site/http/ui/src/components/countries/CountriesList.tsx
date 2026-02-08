import { Box, Button, Paper, Tooltip, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ReactCountryFlag from "react-country-flag";
import { Link as RouterLink } from "react-router-dom";
import { useCountries } from "./useCountries";
import markerIcon from "../../../assets/marker.png";

const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

interface CountriesListProps {
  limit?: number;
  title?: string;
  showBars?: boolean;
  columns?: 1 | 2;
  startIndex?: number;
  viewAllLink?: string;
}

function CountryRow({
  country,
  code,
  count,
  i,
  maxCount,
  showBar,
}: {
  country: string;
  code: string;
  count: number;
  i: number;
  maxCount: number;
  showBar: boolean;
}) {
  const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: showBar
          ? "28px 40px 1fr 1fr auto"
          : "28px 40px 1fr auto",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.75,
        borderRadius: 2,
        background:
          i < 3
            ? `linear-gradient(90deg, ${medalColors[i]}18 0%, transparent 60%)`
            : "transparent",
        borderLeft:
          i < 3 ? `4px solid ${medalColors[i]}` : "4px solid transparent",
        transition: "background 0.15s",
        "&:hover": { background: "action.hover" },
      }}
    >
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: i < 3 ? "1.25rem" : "1rem",
          textAlign: "center",
          color: i < 3 ? medalColors[i] : "text.disabled",
        }}
      >
        {i + 1}
      </Typography>

      <Tooltip title={country} arrow>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            overflow: "hidden",
            border: i < 3 ? `2px solid ${medalColors[i]}` : "2px solid",
            borderColor: i < 3 ? undefined : "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              i < 3
                ? `0 2px 8px ${medalColors[i]}40`
                : "0 1px 3px rgba(0,0,0,0.12)",
            flexShrink: 0,
          }}
        >
          <ReactCountryFlag
            countryCode={code.toUpperCase()}
            svg
            style={{
              width: "140%",
              height: "140%",
              objectFit: "cover",
            }}
          />
        </Box>
      </Tooltip>

      <Typography
        noWrap
        sx={{
          fontWeight: i < 3 ? 700 : 400,
          fontSize: "0.9rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {country}
      </Typography>

      {showBar && (
        <Box sx={{ position: "relative", height: 16, borderRadius: 8, bgcolor: "#f5f5f5", overflow: "hidden" }}>
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${barPct}%`,
              borderRadius: 8,
              background:
                i < 3
                  ? `linear-gradient(90deg, ${medalColors[i]}, ${medalColors[i]}99)`
                  : "linear-gradient(90deg, #ffb74d, #ffa726)",
              transition: "width 0.4s ease",
            }}
          />
        </Box>
      )}

      <Tooltip title="Найдено постов" arrow>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            justifyContent: "flex-end",
          }}
        >
          <img src={markerIcon} alt="" width={16} height={16} />
          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", minWidth: 32, textAlign: "right" }}>
            {count}
          </Typography>
        </Box>
      </Tooltip>
    </Box>
  );
}

export default function CountriesList({
  limit,
  title,
  showBars = false,
  columns = 1,
  startIndex = 0,
  viewAllLink,
}: CountriesListProps) {
  const { data: countries = [] } = useCountries();

  const items = limit ? countries.slice(startIndex, startIndex + limit) : countries.slice(startIndex);

  if (items.length === 0) return null;

  const maxCount = countries.length > 0 ? countries[0].count : 1;

  const content =
    columns === 2 ? (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 1,
        }}
      >
        {items.map((c, idx) => (
          <CountryRow
            key={c.code}
            country={c.country}
            code={c.code}
            count={c.count}
            i={startIndex + idx}
            maxCount={maxCount}
            showBar={showBars}
          />
        ))}
      </Box>
    ) : (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {items.map((c, idx) => (
          <CountryRow
            key={c.code}
            country={c.country}
            code={c.code}
            count={c.count}
            i={startIndex + idx}
            maxCount={maxCount}
            showBar={showBars}
          />
        ))}
      </Box>
    );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {title && (
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            mb: 3,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {title}
        </Typography>
      )}
      {content}

      {viewAllLink && (
        <Button
          component={RouterLink}
          to={viewAllLink}
          endIcon={<ArrowForwardIcon />}
          sx={{ mt: "auto", pt: 2, display: "flex", mx: "auto" }}
        >
          Смотреть все
        </Button>
      )}
    </Paper>
  );
}
