import { Link } from "react-router-dom";
import type { NotFoundPost } from "./useNotFoundPosts";
import MiniMap from "./MiniMap";
import { plural } from "../../utils/plural";
import {
  countryName,
  daysBetween,
  formatSolveTime,
  postUrl,
  tierMarkers,
  tierNames,
} from "./cardUtils";
import "./CardBack.css";

interface Props {
  post: NotFoundPost;
  foundDate?: string;
  /** solved cards: show where it was found instead of the emblem */
  details: boolean;
  active: boolean;
}

const stop = (e: React.MouseEvent) => e.stopPropagation();

/**
 * The back of the card: the tier emblem printed big and worn, like the logo
 * on a real card back. Solved cards, once turned over by hand, show the find
 * instead: a map of the spot, who solved it and how long it took.
 */
export default function CardBack({
  post,
  foundDate,
  details,
  active,
}: Readonly<Props>) {
  const foundAt = post.found_date ?? foundDate;
  const solved = post.is_found && Boolean(foundAt);

  return (
    <div className="post-card__back">
      <div className="post-card__body" />
      <div
        className={`post-card__back-side${solved && details ? " is-hidden" : ""}`}
      >
        <div className="post-card__back-heading">{tierNames[post.tier]}</div>
        <div className="post-card__emblem" aria-hidden="true" />
        <div className="post-card__wordmark">findthisplace</div>
        {!solved && <Searching post={post} />}
      </div>
      {solved && foundAt && (
        <div
          className={`post-card__back-side post-card__back-side--found${details ? "" : " is-hidden"}`}
        >
          <Found post={post} foundAt={foundAt} />
        </div>
      )}
      {active && <div className="post-card__back-gloss" />}
    </div>
  );
}

function Searching({ post }: Readonly<{ post: NotFoundPost }>) {
  const days = daysBetween(post.created_date);
  return (
    <>
      <div className="post-card__back-title">Место ещё не найдено</div>
      <div className="post-card__back-note">
        ищем уже {days.toLocaleString("ru-RU")} {plural(days, "день", true)}
      </div>
      <a
        className="post-card__back-link"
        href={postUrl(post.id)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
      >
        Помочь найти ↗
      </a>
    </>
  );
}

function Found({
  post,
  foundAt,
}: Readonly<{ post: NotFoundPost; foundAt: string }>) {
  const { latitude, longitude } = post;
  const hasSpot =
    latitude !== undefined &&
    longitude !== undefined &&
    !(latitude === 0 && longitude === 0);
  const seconds =
    (new Date(foundAt).getTime() - new Date(post.created_date).getTime()) /
    1000;
  const date = new Date(foundAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div className="post-card__back-heading">
        {post.country_code
          ? `Найдено · ${countryName(post.country_code)}`
          : "Найдено"}
      </div>
      {hasSpot ? (
        <MiniMap
          latitude={latitude}
          longitude={longitude}
          pin={tierMarkers[post.tier] ?? tierMarkers[0]}
        />
      ) : (
        <div
          className="post-card__emblem post-card__emblem--small"
          aria-hidden="true"
        />
      )}
      <dl className="post-card__back-facts">
        {post.found_by && (
          <div>
            <dt>Разгадал</dt>
            <dd>
              {post.found_by_id ? (
                <Link to={`/searchers/${post.found_by_id}`} onClick={stop}>
                  {post.found_by}
                </Link>
              ) : (
                post.found_by
              )}
            </dd>
          </div>
        )}
        {seconds > 0 && (
          <div>
            <dt>Нашли за</dt>
            <dd>{formatSolveTime(seconds)}</dd>
          </div>
        )}
        <div>
          <dt>Дата</dt>
          <dd>{date}</dd>
        </div>
      </dl>
      <a
        className="post-card__back-link"
        href={postUrl(post.id)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={stop}
      >
        Открыть пост ↗
      </a>
    </>
  );
}
