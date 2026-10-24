import { tierCounts, useSearchers } from "./useSearchers";
import {
  Breakdown,
  LeaderboardCard,
  LeaderboardRow,
  places,
  TIERS,
  tierSegments,
  UserAvatar,
} from "../leaderboard/Leaderboard";
import { formatDuration } from "../../utils/formatDuration";

export default function TopSearchers() {
  const { data: searchers = [], isPending } = useSearchers(10);

  if (!isPending && searchers.length === 0) return null;

  const ranks = places(searchers.map((s) => s.found_tiers_total));

  return (
    <LeaderboardCard
      title="Сыщики"
      subtitle="кто нашёл больше всего мест"
      legend={TIERS}
      viewAllLink="/searchers"
      viewAllLabel="Смотреть всех"
      loading={isPending}
    >
      {searchers.map((s, i) => {
        const segments = tierSegments(tierCounts(s));
        return (
          <LeaderboardRow
            key={s.id}
            rank={ranks[i]}
            to={`/searchers/${s.id}`}
            avatar={<UserAvatar src={s.avatar_url} login={s.login} />}
            name={s.login}
            value={s.found_tiers_total}
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
