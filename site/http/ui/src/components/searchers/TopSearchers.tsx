import { Searcher, useSearchers } from "./useSearchers";
import {
  Breakdown,
  COUNT_COLOR,
  LeaderboardCard,
  LeaderboardRow,
  LegendItem,
  UserAvatar,
} from "../leaderboard/Leaderboard";
import { formatDuration } from "../../utils/formatDuration";

// the colours of the tier pins on the map; silver and gold a shade deeper,
// or they would vanish against the white card
const tierColors = [COUNT_COLOR, "#c87830", "#b4bfcc", "#e8a400", "#c0187e"];
// the cards' tier names, but "новое" agrees with "место", not the card
const tierLabels = ["новое", "бронза", "серебро", "золото", "эпик"];
const tierWaits = [
  "меньше полугода",
  "от полугода до года",
  "1–2 года",
  "2–5 лет",
  "больше 5 лет",
];

const tiers: LegendItem[] = tierLabels.map((label, t) => ({
  label,
  color: tierColors[t],
  hint: `загадка ждала сыщика ${tierWaits[t]}`,
}));

function tierCounts(s: Searcher): number[] {
  return [
    s.found_tier0,
    s.found_tier1,
    s.found_tier2,
    s.found_tier3,
    s.found_tier4,
  ];
}

export default function TopSearchers() {
  const { data: searchers = [], isPending } = useSearchers(10);

  if (!isPending && searchers.length === 0) return null;

  const max = Math.max(0, ...searchers.map((s) => s.found_tiers_total));

  return (
    <LeaderboardCard
      title="Сыщики"
      subtitle="кто нашёл больше всего мест"
      legend={tiers}
      viewAllLink="/searchers"
      viewAllLabel="Смотреть всех"
      loading={isPending}
    >
      {searchers.map((s, i) => {
        const segments = tierCounts(s).map((value, t) => ({
          ...tiers[t],
          value,
        }));
        return (
          <LeaderboardRow
            key={s.id}
            rank={i + 1}
            to={`/searchers/${s.id}`}
            avatar={<UserAvatar src={s.avatar_url} login={s.login} />}
            name={s.login}
            value={s.found_tiers_total}
            max={max}
            segments={segments}
            details={
              <Breakdown
                segments={segments}
                note={`в среднем на поиск: ${formatDuration(s.avg_search_time)}`}
              />
            }
          />
        );
      })}
    </LeaderboardCard>
  );
}
