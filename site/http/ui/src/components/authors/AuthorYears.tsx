import { FOUND, NOT_FOUND, puzzleSegments } from "./useAuthors";
import YearLeaders from "../users/YearLeaders";
import type { UserYear } from "../users/useUserYears";

export default function AuthorYears({
  years,
  loading,
}: Readonly<{ years: UserYear[]; loading: boolean }>) {
  return (
    <YearLeaders
      title="Авторы года"
      subtitle="сколько мест загадали за год и кто загадал больше всех"
      years={years}
      loading={loading}
      profile={(id) => `/authors/${id}`}
      segments={(y) => puzzleSegments(y.count - (y.nfound ?? 0), y.nfound ?? 0)}
      note={(y) => `авторов: ${y.users}`}
      legend={[FOUND, NOT_FOUND]}
    />
  );
}
