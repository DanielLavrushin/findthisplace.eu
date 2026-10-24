import YearLeaders from "../users/YearLeaders";
import type { UserYear } from "../users/useUserYears";
import { TIERS, tierSegments } from "../leaderboard/Leaderboard";

export default function SearcherYears({
  years,
  loading,
}: Readonly<{ years: UserYear[]; loading: boolean }>) {
  return (
    <YearLeaders
      title="Сыщики года"
      subtitle="сколько мест нашли за год и кто нашёл больше всех"
      years={years}
      loading={loading}
      profile={(id) => `/searchers/${id}`}
      segments={(y) => tierSegments(y.tiers ?? [])}
      note={(y) => `сыщиков: ${y.users}`}
      legend={TIERS}
    />
  );
}
