import { useCallback } from "react";
import { Link } from "react-router-dom";
import ReactCountryFlag from "react-country-flag";
import type { NotFoundPost } from "./useNotFoundPosts";
import { useHoloTilt } from "./useHoloTilt";
import tire0marker from "../../../assets/tire0marker.png";
import tire1marker from "../../../assets/tire1marker.png";
import tire2marker from "../../../assets/tire2marker.png";
import tire3marker from "../../../assets/tire3marker.png";
import tire4marker from "../../../assets/tire4marker.png";
import "./PostCard.css";

const tierMarkers = [
  tire0marker,
  tire1marker,
  tire2marker,
  tire3marker,
  tire4marker,
];

function tornMask(seed: number): string {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='4' seed='${seed}'/%3E%3CfeDisplacementMap in='SourceGraphic' scale='15'/%3E%3C/filter%3E%3Crect width='200' height='200' rx='8' filter='url(%23f)' fill='white'/%3E%3C/svg%3E")`;
}

function daysBetween(fromStr: string, toStr?: string): number {
  const from = new Date(fromStr);
  const to = toStr ? new Date(toStr) : new Date();
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

interface Props {
  post: NotFoundPost;
  foundDate?: string;
}

export default function PostCard({
  post,
  foundDate,
}: Readonly<Props>) {
  const { cardRef, active, onPointerMove, onPointerLeave } =
    useHoloTilt<HTMLDivElement>();

  const handleCardClick = useCallback(() => {
    window.open(
      `https://findthisplace.d3.ru/${post.id}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [post.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCardClick();
      }
    },
    [handleCardClick],
  );

  const days = post.created_date
    ? daysBetween(post.created_date, post.found_date ?? foundDate)
    : null;
  const marker = tierMarkers[post.tier] ?? tierMarkers[0];

  return (
    <div
      ref={cardRef}
      className={`post-card${active ? " interacting" : ""}`}
      data-tier={post.tier}
    >
      <div className="post-card__translater">
        <div
          className="post-card__rotator"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={handleCardClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`View post: ${post.title}`}
        >
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
                    <div className="post-card__stamp">
                      <div className="post-card__stamp-inner">
                        <ReactCountryFlag
                          countryCode={post.country_code.toUpperCase()}
                          svg
                          style={{
                            width: "70%",
                            height: "70%",
                            objectFit: "cover",
                            borderRadius: "2px",
                            filter: "saturate(0.9) contrast(1.05)",
                          }}
                        />
                        <div className="post-card__stamp-holo" />
                      </div>
                    </div>
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
                href={`https://findthisplace.d3.ru/${post.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                #{String(post.id).padStart(4, "0")}
              </a>
            </div>
          </div>

          {active && <div className="post-card__glare" />}
        </div>
      </div>
    </div>
  );
}
