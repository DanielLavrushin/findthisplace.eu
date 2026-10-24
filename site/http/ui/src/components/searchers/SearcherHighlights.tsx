import { useMemo, type ComponentProps } from "react";
import { Searcher } from "./useSearchers";
import StatCards, { StatCardProps } from "../stats/StatCards";
import { UserAvatar } from "../leaderboard/Leaderboard";
import type { ListUser } from "../users/UserList";
import type { UserYear } from "../users/useUserYears";
import { withinYear } from "../users/activity";
import { mostYearsFirst, yearRecord, yearSpans } from "../users/yearFacts";
import { formatSolveTime } from "../posts/cardUtils";
import { pick } from "../../utils/pick";
import { plural } from "../../utils/plural";

// an average over fewer finds says more about the finds than the searcher
const MIN_FINDS_FOR_AVERAGE = 10;

function searcherCard(
  s: ListUser,
  card: Omit<StatCardProps, "icon" | "value" | "to">,
): StatCardProps {
  return {
    icon: <UserAvatar src={s.avatar_url} login={s.login} />,
    value: s.login,
    to: `/searchers/${s.id}`,
    ...card,
  };
}

export default function SearcherHighlights({
  searchers,
  years,
  ...layout
}: Readonly<
  { searchers: Searcher[]; years: UserYear[] } & Pick<
    ComponentProps<typeof StatCards>,
    "columns" | "sx"
  >
>) {
  const cards = useMemo(() => {
    const result: StatCardProps[] = [];

    const champion = mostYearsFirst(years);
    // once is the table's to tell
    if (champion && champion.years.length > 1) {
      result.push(
        searcherCard(champion.leader, {
          label: "Чаще всех сыщик года",
          sublabel: `${plural(champion.years.length, "раз")}: ${yearSpans(champion.years)}`,
          gradient: "linear-gradient(135deg, #d4a843 0%, #c49530 100%)",
        }),
      );
    }

    const record = yearRecord(years);
    if (record) {
      result.push(
        searcherCard(record.leader, {
          label: "Рекорд года",
          sublabel: `${plural(record.leader.count, "находка")} в ${record.year} году`,
          gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
        }),
      );
    }

    const epic = pick(searchers, (a, b) => a.found_tier4 > b.found_tier4);
    if (epic && epic.found_tier4 > 0) {
      result.push(
        searcherCard(epic, {
          label: "Охотник за эпиками",
          sublabel: `эпических находок: ${epic.found_tier4}`,
          gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        }),
      );
    }

    const fastest = pick(
      searchers.filter(
        (s) => s.found_tiers_total >= MIN_FINDS_FOR_AVERAGE && s.avg_search_time > 0,
      ),
      (a, b) => a.avg_search_time < b.avg_search_time,
    );
    if (fastest) {
      result.push(
        searcherCard(fastest, {
          label: "Быстрее всех",
          sublabel: `в среднем ${formatSolveTime(fastest.avg_search_time)} на поиск`,
          gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        }),
      );
    }

    // one find is a visit; a newcomer keeps coming back
    const newcomer = pick(
      searchers.filter((s) => withinYear(s.first_found) && s.found_tiers_total > 1),
      (a, b) => a.found_tiers_total > b.found_tiers_total,
    );
    if (newcomer) {
      const since = new Date(newcomer.first_found!).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      result.push(
        searcherCard(newcomer, {
          label: "Новичок года",
          sublabel: `${plural(newcomer.found_tiers_total, "находка")} с ${since}`,
          gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        }),
      );
    }

    const veteran = pick(
      searchers.filter((s) => withinYear(s.last_found) && s.first_found),
      (a, b) => a.first_found! < b.first_found!,
    );
    if (veteran) {
      result.push(
        searcherCard(veteran, {
          label: "Старожил",
          sublabel: `ищет с ${new Date(veteran.first_found!).getFullYear()} года`,
          gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }),
      );
    }

    return result;
  }, [searchers, years]);

  return <StatCards title="Интересные факты" cards={cards} {...layout} />;
}
