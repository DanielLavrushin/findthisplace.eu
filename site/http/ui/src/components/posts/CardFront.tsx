import { Link } from "react-router-dom";
import type { NotFoundPost } from "./useNotFoundPosts";
import Postmark from "./Postmark";
import {
  countryName,
  daysBetween,
  flagUrl,
  postUrl,
  tierMarkers,
  tornMask,
} from "./cardUtils";
import { countrySlug } from "../../utils/countries";

interface Props {
  post: NotFoundPost;
  foundDate?: string;
  /** mount the light and foil layers (only while the card is lit) */
  active: boolean;
}

export default function CardFront({
  post,
  foundDate,
  active,
}: Readonly<Props>) {
  const foundAt = post.found_date ?? foundDate;
  const days = post.created_date
    ? daysBetween(post.created_date, foundAt)
    : null;
  const marker = tierMarkers[post.tier] ?? tierMarkers[0];
  const place = post.country_code ? countryName(post.country_code) : "";
  const placeSlug = post.country_code ? countrySlug(post.country_code) : undefined;

  const stamp = post.country_code && (
    <div className="post-card__stamp-inner">
      <div className="post-card__stamp-window">
        {/* the flag sits a little below the surface film */}
        <div className="post-card__stamp-depth">
          <div
            className="post-card__stamp-flag"
            role="img"
            aria-label={post.country_code.toUpperCase()}
          />
          {active && (
            <div className="post-card__stamp-foil" aria-hidden="true">
              <div className="post-card__stamp-relief">
                <div />
                <div />
              </div>
              <div className="post-card__stamp-spectrum" />
            </div>
          )}
        </div>
        {active && <div className="post-card__stamp-gloss" />}
      </div>
    </div>
  );
  const stampStyle = post.country_code
    ? ({
        "--flag-url": `url(${JSON.stringify(flagUrl(post.country_code))})`,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="post-card__front">
      <div className="post-card__body" />

      {/* reverse-holo foil: lies on the card stock, under the print */}
      {active && (
        <div className="post-card__foil" aria-hidden="true">
          <div className="post-card__foil-sheen" />
          <div className="post-card__foil-pattern" />
          <div className="post-card__foil-flakes" />
        </div>
      )}

      <div className="post-card__content">
        <div className="post-card__header">
          <img className="post-card__header-marker" src={marker} alt="" />
          {days !== null && (
            <div className="post-card__days">
              <span>дней</span>
              <span className="post-card__days-number">{days}</span>
            </div>
          )}
        </div>

        <div className="post-card__title">{post.title}</div>

        <div className="post-card__image-wrap">
          <div
            className="post-card__photo"
            style={
              post.main_image_url
                ? ({
                    "--torn": tornMask(post.id),
                    "--photo-url": `url(${JSON.stringify(post.main_image_url)})`,
                  } as React.CSSProperties)
                : undefined
            }
          >
            {post.main_image_url && (
              <>
                <div className="post-card__photo-shadow">
                  <div />
                </div>
                <div className="post-card__photo-rim" />
                <div className="post-card__photo-print">
                  <img
                    className="post-card__image"
                    src={post.main_image_url}
                    alt={post.title}
                    loading="lazy"
                  />
                  {/* light raking across the photo: relief + etched holo */}
                  {active && (
                    <div className="post-card__photo-fx" aria-hidden="true">
                      <div className="post-card__relief">
                        <div />
                        <div />
                      </div>
                      <div className="post-card__photo-holo" />
                    </div>
                  )}
                </div>
              </>
            )}
            {post.is_found && post.country_code && (
              <>
                {/* the stamp is the way to every place in its country */}
                {placeSlug ? (
                  <Link
                    className="post-card__stamp post-card__stamp--link"
                    to={`/tags/${placeSlug}`}
                    style={stampStyle}
                    title={`Все места: ${place}`}
                    aria-label={`Все места: ${place}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {stamp}
                  </Link>
                ) : (
                  <div className="post-card__stamp" style={stampStyle}>
                    {stamp}
                  </div>
                )}
                {foundAt && (
                  <Postmark date={foundAt} place={place} seed={post.id} />
                )}
              </>
            )}
          </div>
        </div>

        <div className="post-card__footer">
          <div className="post-card__footer-left">
            <span className="post-card__author-label">
              {post.gender === "female" ? "Загадала" : "Загадал"}
            </span>
            {post.user_id ? (
              <Link
                className="post-card__author post-card__author--link"
                to={`/authors/${post.user_id}`}
                onClick={(e) => e.stopPropagation()}
              >
                {post.username}
              </Link>
            ) : (
              <span className="post-card__author">{post.username}</span>
            )}
          </div>
          {post.found_by && (
            <div className="post-card__footer-right">
              <span className="post-card__author-label">Разгадал</span>
              {post.found_by_id ? (
                <Link
                  className="post-card__author post-card__author--link"
                  to={`/searchers/${post.found_by_id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {post.found_by}
                </Link>
              ) : (
                <span className="post-card__author">{post.found_by}</span>
              )}
            </div>
          )}
        </div>
        <a
          className="post-card__id"
          href={postUrl(post.id)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          #{String(post.id).padStart(4, "0")}
        </a>
      </div>
    </div>
  );
}
