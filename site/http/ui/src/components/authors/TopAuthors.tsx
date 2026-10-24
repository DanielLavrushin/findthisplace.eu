import { FOUND, NOT_FOUND, puzzleSegments, useAuthors } from "./useAuthors";
import {
  Breakdown,
  LeaderboardCard,
  LeaderboardRow,
  places,
  UserAvatar,
} from "../leaderboard/Leaderboard";
import { formatDuration } from "../../utils/formatDuration";

export default function TopAuthors() {
  const { data: authors = [], isPending } = useAuthors(10);

  if (!isPending && authors.length === 0) return null;

  const ranks = places(authors.map((a) => a.author_posts_total));

  return (
    <LeaderboardCard
      title="Авторы"
      subtitle="кто загадал больше всего мест"
      legend={[FOUND, NOT_FOUND]}
      viewAllLink="/authors"
      viewAllLabel="Смотреть всех"
      loading={isPending}
    >
      {authors.map((a, i) => {
        const segments = puzzleSegments(a.author_posts_found, a.author_posts_nfound);
        return (
          <LeaderboardRow
            key={a.id}
            rank={ranks[i]}
            to={`/authors/${a.id}`}
            avatar={<UserAvatar src={a.avatar_url} login={a.login} />}
            name={a.login}
            value={a.author_posts_total}
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
