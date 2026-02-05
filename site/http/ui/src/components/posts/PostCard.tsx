import { useCallback, useRef, useState } from "react";
import ReactCountryFlag from "react-country-flag";
import type { NotFoundPost } from "./useNotFoundPosts";
import tire0marker from "../../../assets/tire0marker.png";
import tire1marker from "../../../assets/tire1marker.png";
import tire2marker from "../../../assets/tire2marker.png";
import tire3marker from "../../../assets/tire3marker.png";
import tire4marker from "../../../assets/tire4marker.png";
import glitterImg from "../../../assets/glitter.png";
import "./PostCard.css";

const tierMarkers = [
  tire0marker,
  tire1marker,
  tire2marker,
  tire3marker,
  tire4marker,
];

function clamp(val: number, min = 0, max = 100) {
  return Math.min(Math.max(val, min), max);
}

function round(val: number, precision = 3) {
  return Number.parseFloat(val.toFixed(precision));
}

function adjust(
  val: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
) {
  return round(
    toMin + ((val - fromMin) / (fromMax - fromMin)) * (toMax - toMin),
  );
}

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
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [interacting, setInteracting] = useState(false);
  const [style, setStyle] = useState<Record<string, string>>({});

  const interact = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setInteracting(true);

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const absolute = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    const percent = {
      x: clamp(round((100 / rect.width) * absolute.x)),
      y: clamp(round((100 / rect.height) * absolute.y)),
    };
    const center = {
      x: percent.x - 50,
      y: percent.y - 50,
    };

    const fromCenter = clamp(Math.hypot(center.x, center.y) / 50, 0, 1);

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setStyle({
        "--pointer-x": `${round(percent.x)}%`,
        "--pointer-y": `${round(percent.y)}%`,
        "--pointer-from-center": `${round(fromCenter)}`,
        "--pointer-from-top": `${round(percent.y / 100)}`,
        "--pointer-from-left": `${round(percent.x / 100)}`,
        "--card-opacity": "1",
        "--rotate-x": `${round(-(center.x / 3.5))}deg`,
        "--rotate-y": `${round(center.y / 3.5)}deg`,
        "--background-x": `${adjust(percent.x, 0, 100, 37, 63)}%`,
        "--background-y": `${adjust(percent.y, 0, 100, 33, 67)}%`,
        "--card-scale": "1.05",
        "--translate-y": "-5px",
      });
      rafRef.current = null;
    });
  }, []);

  const interactEnd = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setInteracting(false);
    setStyle({
      "--pointer-x": "50%",
      "--pointer-y": "50%",
      "--pointer-from-center": "0",
      "--pointer-from-top": "0.5",
      "--pointer-from-left": "0.5",
      "--card-opacity": "0",
      "--rotate-x": "0deg",
      "--rotate-y": "0deg",
      "--background-x": "50%",
      "--background-y": "50%",
      "--card-scale": "1",
      "--translate-y": "0px",
    });
  }, []);

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
    ? daysBetween(post.created_date, foundDate)
    : null;
  const marker = tierMarkers[post.tier] ?? tierMarkers[0];

  return (
    <div
      ref={cardRef}
      className={`post-card${interacting ? " interacting" : ""}`}
      data-tier={post.tier}
      style={
        { "--glitter": `url(${glitterImg})`, ...style } as React.CSSProperties
      }
    >
      <div className="post-card__translater">
        <div
          className="post-card__rotator"
          onPointerMove={interact}
          onPointerLeave={interactEnd}
          onClick={handleCardClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`View post: ${post.title}`}
          style={{ cursor: "pointer" }}
        >
          <div className="post-card__front">
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
                {post.main_image_url && (
                  <img
                    className="post-card__image"
                    src={post.main_image_url}
                    alt={post.title}
                    loading="lazy"
                    style={{
                      maskImage: tornMask(post.id),
                      WebkitMaskImage: tornMask(post.id),
                    }}
                  />
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

              <div className="post-card__footer">
                <div className="post-card__footer-left">
                  <span className="post-card__author-label">
                    {post.gender === "female" ? "Загадала" : "Загадал"}
                  </span>
                  <span className="post-card__author">{post.username}</span>
                </div>
                {post.found_by && (
                  <div className="post-card__footer-right">
                    <span className="post-card__author-label">Разгадал</span>
                    <span className="post-card__author">{post.found_by}</span>
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

          <div className="post-card__shine" />
          <div className="post-card__glare" />
        </div>
      </div>
    </div>
  );
}
