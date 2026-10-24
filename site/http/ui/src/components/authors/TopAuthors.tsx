import { useAuthors } from "./useAuthors";
import {
  Breakdown,
  COUNT_COLOR,
  LeaderboardCard,
  LeaderboardRow,
  LegendItem,
  UserAvatar,
} from "../leaderboard/Leaderboard";
import { formatDuration } from "../../utils/formatDuration";

const found: LegendItem = { label: "найдены", color: COUNT_COLOR };
const notFound: LegendItem = {
  label: "не найдены",
  color: "#d9761a",
  hint: "ещё ждут сыщика",
};

export default function TopAuthors() {
  const { data: authors = [], isPending } = useAuthors(10);

  if (!isPending && authors.length === 0) return null;

  const max = Math.max(0, ...authors.map((a) => a.author_posts_total));

  return (
    <LeaderboardCard
      title="Авторы"
      subtitle="кто загадал больше всего мест"
      legend={[found, notFound]}
      viewAllLink="/authors"
      viewAllLabel="Смотреть всех"
      loading={isPending}
    >
      {authors.map((a, i) => {
        const segments = [
          { ...found, value: a.author_posts_found },
          { ...notFound, value: a.author_posts_nfound },
        ];
        return (
          <LeaderboardRow
            key={a.id}
            rank={i + 1}
            to={`/authors/${a.id}`}
            avatar={<UserAvatar src={a.avatar_url} login={a.login} />}
            name={a.login}
            value={a.author_posts_total}
            max={max}
            segments={segments}
            details={
              <Breakdown
                segments={segments}
                note={
                  a.avg_author_time > 0
                    ? `в среднем до разгадки: ${formatDuration(a.avg_author_time)}`
                    : undefined
                }
              />
            }
          />
        );
      })}
    </LeaderboardCard>
  );
}
