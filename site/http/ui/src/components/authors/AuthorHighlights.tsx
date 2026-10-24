import { useMemo, type ComponentProps } from "react";
import { Author } from "./useAuthors";
import StatCards, { StatCardProps } from "../stats/StatCards";
import { UserAvatar } from "../leaderboard/Leaderboard";
import type { ListUser } from "../users/UserList";
import type { UserYear } from "../users/useUserYears";
import { withinYear } from "../users/activity";
import { mostYearsFirst, yearRecord, yearSpans } from "../users/yearFacts";
import { formatDuration } from "../../utils/formatDuration";
import { pick } from "../../utils/pick";
import { plural } from "../../utils/plural";

// an average over fewer solved puzzles says more about them than the author
const MIN_FOUND_FOR_AVERAGE = 10;

function authorCard(
  a: ListUser,
  card: Omit<StatCardProps, "icon" | "value" | "to">,
): StatCardProps {
  return {
    icon: <UserAvatar src={a.avatar_url} login={a.login} />,
    value: a.login,
    to: `/authors/${a.id}`,
    ...card,
  };
}

export default function AuthorHighlights({
  authors,
  years,
  ...layout
}: Readonly<
  { authors: Author[]; years: UserYear[] } & Pick<
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
        authorCard(champion.leader, {
          label: "Чаще всех автор года",
          sublabel: `${plural(champion.years.length, "раз")}: ${yearSpans(champion.years)}`,
          gradient: "linear-gradient(135deg, #d4a843 0%, #c49530 100%)",
        }),
      );
    }

    const record = yearRecord(years);
    if (record) {
      result.push(
        authorCard(record.leader, {
          label: "Рекорд года",
          sublabel: `${plural(record.leader.count, "загадка")} в ${record.year} году`,
          gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
        }),
      );
    }

    const master = pick(authors, (a, b) => a.author_posts_nfound > b.author_posts_nfound);
    if (master && master.author_posts_nfound > 0) {
      result.push(
        authorCard(master, {
          label: "Мастер загадок",
          sublabel: `ждут своего часа: ${master.author_posts_nfound}`,
          gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        }),
      );
    }

    const hardest = pick(
      authors.filter(
        (a) => a.author_posts_found >= MIN_FOUND_FOR_AVERAGE && a.avg_author_time > 0,
      ),
      (a, b) => a.avg_author_time > b.avg_author_time,
    );
    if (hardest) {
      result.push(
        authorCard(hardest, {
          label: "Крепкий орешек",
          sublabel: `в среднем ${formatDuration(hardest.avg_author_time)} до разгадки`,
          gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        }),
      );
    }

    // one puzzle is a visit; a newcomer keeps coming back
    const newcomer = pick(
      authors.filter((a) => withinYear(a.first_post) && a.author_posts_total > 1),
      (a, b) => a.author_posts_total > b.author_posts_total,
    );
    if (newcomer) {
      const since = new Date(newcomer.first_post!).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      result.push(
        authorCard(newcomer, {
          label: "Новичок года",
          sublabel: `${plural(newcomer.author_posts_total, "загадка")} с ${since}`,
          gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        }),
      );
    }

    const veteran = pick(
      authors.filter((a) => withinYear(a.last_post) && a.first_post),
      (a, b) => a.first_post! < b.first_post!,
    );
    if (veteran) {
      result.push(
        authorCard(veteran, {
          label: "Старожил",
          sublabel: `загадывает с ${new Date(veteran.first_post!).getFullYear()} года`,
          gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }),
      );
    }

    return result;
  }, [authors, years]);

  return <StatCards title="Интересные факты" cards={cards} {...layout} />;
}
