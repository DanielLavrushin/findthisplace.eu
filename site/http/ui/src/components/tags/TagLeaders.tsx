import type { TagUser } from "./useTagDetail";
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

interface BoardProps {
  title: string;
  subtitle: string;
  users: TagUser[];
  /** the profile a row opens */
  profile: (id: number) => string;
  /** what the average wait means for these users */
  waitNote: string;
}

function Board({ title, subtitle, users, profile, waitNote }: Readonly<BoardProps>) {
  if (users.length === 0) return null;

  const ranks = places(users.map((u) => u.count));

  return (
    <LeaderboardCard
      title={title}
      subtitle={subtitle}
      legend={TIERS}
      loading={false}
    >
      {users.map((u, i) => {
        const segments = tierSegments(u.tiers);
        return (
          <LeaderboardRow
            key={u.id}
            rank={ranks[i]}
            to={profile(u.id)}
            avatar={<UserAvatar src={u.avatar_url} login={u.login} />}
            name={u.login}
            value={u.count}
            segments={segments}
            details={
              <Breakdown
                segments={segments}
                note={
                  u.avg_search_time > 0
                    ? `${waitNote}: ${formatDuration(u.avg_search_time)}`
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

export function TagSearchers({ users }: Readonly<{ users: TagUser[] }>) {
  return (
    <Board
      title="Сыщики"
      subtitle="кто нашёл здесь больше всего мест"
      users={users}
      profile={(id) => `/searchers/${id}`}
      waitNote="в среднем на поиск"
    />
  );
}

export function TagAuthors({ users }: Readonly<{ users: TagUser[] }>) {
  return (
    <Board
      title="Авторы"
      subtitle="кто загадал здесь больше всего мест"
      users={users}
      profile={(id) => `/authors/${id}`}
      waitNote="в среднем до разгадки"
    />
  );
}
