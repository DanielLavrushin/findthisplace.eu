import { Searcher, tierCounts } from "./useSearchers";
import UserList, { Ranking } from "../users/UserList";
import { activity } from "../users/activity";
import { Breakdown, TIERS, tierSegments } from "../leaderboard/Leaderboard";
import { formatSolveTime } from "../posts/cardUtils";

const RANKINGS: Ranking<Searcher>[] = [
  {
    key: "all",
    label: "все находки",
    subtitle: "кто сколько мест нашёл",
    value: (s) => s.found_tiers_total,
    empty: "Такого сыщика в списке нет: здесь только те, кто уже что-то нашёл",
  },
  {
    key: "rare",
    label: "редкие",
    subtitle: "кто нашёл больше загадок, ждавших сыщика дольше полугода",
    value: (s) => s.found_tiers_total - s.found_tier0,
    // of equals, the one with the rarer finds
    tiebreak: (a, b) =>
      b.found_tier4 - a.found_tier4 ||
      b.found_tier3 - a.found_tier3 ||
      b.found_tier2 - a.found_tier2,
    empty: "Редких находок у такого сыщика пока нет",
  },
];

const segments = (s: Searcher) => tierSegments(tierCounts(s));

function details(s: Searcher) {
  const when = activity("находка", s.found_tiers_total, s.first_found, s.last_found);
  return (
    <Breakdown
      segments={segments(s)}
      note={
        <>
          {s.avg_search_time > 0 && (
            <div>в среднем на поиск: {formatSolveTime(s.avg_search_time)}</div>
          )}
          {when && <div>{when}</div>}
        </>
      }
    />
  );
}

export default function SearchersList({
  searchers,
  loading,
}: Readonly<{ searchers: Searcher[]; loading: boolean }>) {
  return (
    <UserList
      title="Все сыщики"
      users={searchers}
      loading={loading}
      rankings={RANKINGS}
      segments={segments}
      legend={TIERS}
      profile={(id) => `/searchers/${id}`}
      details={details}
    />
  );
}
