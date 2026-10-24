import { Author, FOUND, NOT_FOUND, puzzleSegments } from "./useAuthors";
import UserList, { Ranking } from "../users/UserList";
import { activity } from "../users/activity";
import { Breakdown } from "../leaderboard/Leaderboard";
import { formatSolveTime } from "../posts/cardUtils";

const RANKINGS: Ranking<Author>[] = [
  {
    key: "all",
    label: "все загадки",
    subtitle: "кто сколько мест загадал",
    value: (a) => a.author_posts_total,
    empty: "Такого автора в списке нет: здесь только те, кто уже что-то загадал",
  },
  {
    key: "waiting",
    label: "ждут своего часа",
    subtitle: "у кого больше всего загадок, которых ещё никто не нашёл",
    value: (a) => a.author_posts_nfound,
    empty: "Все загадки такого автора уже нашли",
  },
];

const segments = (a: Author) => puzzleSegments(a.author_posts_found, a.author_posts_nfound);

function details(a: Author) {
  const when = activity("загадка", a.author_posts_total, a.first_post, a.last_post);
  return (
    <Breakdown
      segments={segments(a)}
      note={
        <>
          {a.avg_author_time > 0 && (
            <div>в среднем до разгадки: {formatSolveTime(a.avg_author_time)}</div>
          )}
          {when && <div>{when}</div>}
        </>
      }
    />
  );
}

export default function AuthorsList({
  authors,
  loading,
}: Readonly<{ authors: Author[]; loading: boolean }>) {
  return (
    <UserList
      title="Все авторы"
      users={authors}
      loading={loading}
      rankings={RANKINGS}
      segments={segments}
      legend={[FOUND, NOT_FOUND]}
      profile={(id) => `/authors/${id}`}
      details={details}
    />
  );
}
