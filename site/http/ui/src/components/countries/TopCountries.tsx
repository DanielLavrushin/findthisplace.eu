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
    <ReactCountryFlag
      countryCode={code.toUpperCase()}
      svg
      alt=""
      style={{
        display: "block",
        width: 32,
        height: 24,
        borderRadius: 3,
        // an edge, or white stripes melt into the card
        boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.12)",
      }}
    />
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
      {top.map((c) => (
        <LeaderboardRow
          key={c.code}
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
