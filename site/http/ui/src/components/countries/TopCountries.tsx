import { Box } from "@mui/material";
import ReactCountryFlag from "react-country-flag";
import { useCountries } from "./useCountries";
import {
  COUNT_COLOR,
  LeaderboardCard,
  LeaderboardRow,
} from "../leaderboard/Leaderboard";
import { countryName } from "../posts/cardUtils";

function Flag({ code }: Readonly<{ code: string }>) {
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ReactCountryFlag
        countryCode={code.toUpperCase()}
        svg
        style={{ width: "140%", height: "140%", objectFit: "cover" }}
      />
    </Box>
  );
}

export default function TopCountries() {
  const { data: countries = [], isPending } = useCountries();
  const top = countries.slice(0, 10);

  if (!isPending && top.length === 0) return null;

  const max = Math.max(0, ...top.map((c) => c.count));

  return (
    <LeaderboardCard
      title="Страны"
      subtitle="где загадано больше всего мест"
      viewAllLink="/tags"
      viewAllLabel="Смотреть все"
      loading={isPending}
    >
      {top.map((c, i) => (
        <LeaderboardRow
          key={c.code}
          rank={i + 1}
          avatar={<Flag code={c.code} />}
          name={countryName(c.code)}
          value={c.count}
          max={max}
          segments={[
            {
              label: "загадки",
              color: COUNT_COLOR,
              dotted: true,
              value: c.count,
            },
          ]}
        />
      ))}
    </LeaderboardCard>
  );
}
