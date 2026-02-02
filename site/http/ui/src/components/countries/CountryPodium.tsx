import { Box, Typography } from "@mui/material";
import ReactCountryFlag from "react-country-flag";
import { Country } from "./useCountries";
import markerIcon from "../../../assets/marker.png";

const podiumColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
const podiumHeights = [90, 68, 52];
const podiumOrder = [1, 0, 2]; // silver, gold, bronze (gold in center)

interface CountryPodiumProps {
  countries: Country[];
}

function PodiumPlace({
  country,
  rank,
}: {
  country: Country;
  rank: number;
}) {
  const color = podiumColors[rank];
  const height = podiumHeights[rank];
  const flagSize = rank === 0 ? 56 : 44;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
        alignSelf: "flex-end",
      }}
    >
      {/* Flag */}
      <Box
        sx={{
          width: flagSize,
          height: flagSize,
          borderRadius: "50%",
          overflow: "hidden",
          border: `3px solid ${color}`,
          boxShadow: `0 3px 12px ${color}60`,
          mb: 0.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ReactCountryFlag
          countryCode={country.code.toUpperCase()}
          svg
          style={{
            width: "140%",
            height: "140%",
            objectFit: "cover",
          }}
        />
      </Box>

      {/* Country name */}
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: rank === 0 ? "0.85rem" : "0.8rem",
          mb: 0.25,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {country.country}
      </Typography>

      {/* Count */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.75 }}>
        <img src={markerIcon} alt="" width={12} height={12} />
        <Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
          {country.count}
        </Typography>
      </Box>

      {/* Podium block */}
      <Box
        sx={{
          width: "100%",
          maxWidth: 100,
          height,
          background: `linear-gradient(180deg, ${color} 0%, ${color}80 100%)`,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          pt: 1,
        }}
      >
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: "1.5rem",
            color: "#fff",
            textShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          {rank + 1}
        </Typography>
      </Box>
    </Box>
  );
}

export default function CountryPodium({ countries }: CountryPodiumProps) {
  const top3 = countries.slice(0, 3);
  if (top3.length < 3) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 1.5,
        px: 2,
        pt: 1,
        width: "100%",
      }}
    >
      {podiumOrder.map((rank) => (
        <PodiumPlace key={rank} country={top3[rank]} rank={rank} />
      ))}
    </Box>
  );
}
