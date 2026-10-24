import { useMemo } from "react";
import type { NotFoundPost } from "../posts/useNotFoundPosts";
import StatCards, { StatCardProps } from "../stats/StatCards";
import { formatSolveTime } from "../posts/cardUtils";
import { formatDuration } from "../../utils/formatDuration";

const relative = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });

/** "сегодня", "3 дня назад", "в прошлом месяце", "2 года назад" */
function ago(date: string): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 30) return relative.format(-days, "day");
  if (days < 365) return relative.format(-Math.floor(days / 30), "month");
  return relative.format(-Math.floor(days / 365), "year");
}

export default function TagFacts({
  posts,
}: Readonly<{ posts: NotFoundPost[] }>) {
  const cards = useMemo(() => {
    const result: StatCardProps[] = [];

    const authors = new Set(posts.map((p) => p.user_id).filter(Boolean)).size;
    const searchers = new Set(posts.map((p) => p.found_by_id).filter(Boolean)).size;
    if (authors > 1) {
      result.push({
        icon: "✍️",
        value: String(authors),
        label: "Авторов",
        sublabel: "загадывали здесь",
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      });
    }
    if (searchers > 1) {
      result.push({
        icon: "🔍",
        value: String(searchers),
        label: "Сыщиков",
        sublabel: "находили здесь",
        gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
      });
    }

    const lastFound = posts.reduce<string | undefined>(
      (last, p) => (p.found_date && (!last || p.found_date > last) ? p.found_date : last),
      undefined,
    );
    if (lastFound) {
      result.push({
        icon: "🕐",
        value: ago(lastFound),
        label: "Последняя находка",
        sublabel: new Date(lastFound).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
      });
    }

    const waits = posts
      .filter((p) => p.found_date && p.created_date)
      .map(
        (p) =>
          (new Date(p.found_date!).getTime() - new Date(p.created_date).getTime()) /
          1000,
      )
      .filter((s) => s > 0);
    // a record needs something to beat
    if (waits.length > 1) {
      result.push(
        {
          icon: "⚡",
          value: formatSolveTime(Math.min(...waits)),
          label: "Быстрее всех нашли",
          sublabel: "рекорд скорости",
          gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        },
        {
          icon: "🏔️",
          value: formatDuration(Math.max(...waits)),
          label: "Дольше всех искали",
          sublabel: "самое сложное место",
          gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        },
      );
    }

    return result;
  }, [posts]);

  return <StatCards title="Интересные факты" cards={cards} />;
}
