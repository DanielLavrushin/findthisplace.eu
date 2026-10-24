import { useMemo, type ComponentProps } from "react";
import Flag from "./Flag";
import { Country } from "./useCountries";
import StatCards, { StatCardProps } from "../stats/StatCards";
import { countryName, formatSolveTime } from "../posts/cardUtils";
import { COUNTRY_COUNT } from "../../utils/countries";
import { pick } from "../../utils/pick";
import { plural } from "../../utils/plural";

// an average over fewer finds says more about the finds than the country
const MIN_FINDS_FOR_AVERAGE = 10;

function countryCard(
  c: Country,
  card: Omit<StatCardProps, "icon" | "value" | "to">,
): StatCardProps {
  return {
    icon: <Flag code={c.code} width={28} />,
    value: countryName(c.code),
    to: `/tags/${c.slug}`,
    ...card,
  };
}

export default function CountryHighlights({
  countries,
  ...layout
}: Readonly<
  { countries: Country[] } & Pick<ComponentProps<typeof StatCards>, "columns" | "sx">
>) {
  const cards = useMemo(() => {
    if (countries.length === 0) return [];
    const result: StatCardProps[] = [];

    const trending = pick(countries, (a, b) => a.found_last_year > b.found_last_year);
    if (trending && trending.found_last_year > 0) {
      result.push(
        countryCard(trending, {
          label: "В тренде",
          sublabel: `${plural(trending.found_last_year, "находка")} за год`,
          gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        }),
      );
    }

    const newcomer = pick(
      countries.filter((c) => c.first_found),
      (a, b) => a.first_found! > b.first_found!,
    );
    if (newcomer) {
      const date = new Date(newcomer.first_found!).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      result.push(
        countryCard(newcomer, {
          label: "Новичок на карте",
          sublabel: `первая находка ${date}`,
          gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        }),
      );
    }

    const averaged = countries.filter(
      (c) => c.count >= MIN_FINDS_FOR_AVERAGE && c.avg_search_time > 0,
    );
    const hardest = pick(averaged, (a, b) => a.avg_search_time > b.avg_search_time);
    const easiest = pick(averaged, (a, b) => a.avg_search_time < b.avg_search_time);
    if (hardest) {
      result.push(
        countryCard(hardest, {
          label: "Крепкий орешек",
          sublabel: `в среднем ${formatSolveTime(hardest.avg_search_time)} на поиск`,
          gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        }),
      );
    }
    if (easiest && easiest !== hardest) {
      result.push(
        countryCard(easiest, {
          label: "Лёгкая добыча",
          sublabel: `в среднем ${formatSolveTime(easiest.avg_search_time)} на поиск`,
          gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
        }),
      );
    }

    const blank = COUNTRY_COUNT - countries.length;
    if (blank > 0) {
      result.push({
        icon: "🗺️",
        value: String(blank),
        label: "Белые пятна",
        sublabel: "стран и территорий ещё ждут первую загадку",
        gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      });
    }

    return result;
  }, [countries]);

  return <StatCards title="Интересные факты" cards={cards} {...layout} />;
}
