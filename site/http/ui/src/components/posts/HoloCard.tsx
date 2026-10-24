import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { NotFoundPost } from "./useNotFoundPosts";
import type { HoloTilt } from "./useHoloTilt";
import CardFront from "./CardFront";

interface Props {
  post: NotFoundPost;
  foundDate?: string;
  tilt: HoloTilt<HTMLDivElement>;
  /** accessible name of the card as a button */
  label: string;
  /** click, Enter or Space on the card */
  onActivate: () => void;
  /** follow the pointer (off while the card is flying back) */
  interactive?: boolean;
  /** the back face, if the card can be turned over */
  back?: ReactNode;
  /** which face is up, for cards that can be turned over */
  flipped?: boolean;
  /** opens the showcase dialog */
  opensDialog?: boolean;
  className?: string;
  /** called once the card is in the DOM, before it is first painted */
  onMount?: () => void;
}

/** The 3D card: root → translater (moves) → rotator (tilts, turns) → faces. */
export default function HoloCard({
  post,
  foundDate,
  tilt,
  label,
  onActivate,
  interactive = true,
  back,
  flipped,
  opensDialog,
  className,
  onMount,
}: Readonly<Props>) {
  // a card rendered through a portal mounts a render after its owner, so the
  // owner can't measure it from its own effects
  const mounted = useRef(onMount);
  useLayoutEffect(() => {
    mounted.current?.();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Enter on a link inside the card (an author, the stamp) follows the link
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };

  const classes = ["post-card"];
  if (tilt.active) classes.push("interacting");
  if (className) classes.push(className);

  return (
    <div ref={tilt.cardRef} className={classes.join(" ")} data-tier={post.tier}>
      <div className="post-card__translater">
        <div
          className={`post-card__rotator${flipped ? " is-flipped" : ""}`}
          onPointerMove={interactive ? tilt.onPointerMove : undefined}
          onPointerLeave={interactive ? tilt.onPointerLeave : undefined}
          onClick={onActivate}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={label}
          aria-haspopup={opensDialog ? "dialog" : undefined}
          aria-pressed={back ? Boolean(flipped) : undefined}
        >
          <CardFront post={post} foundDate={foundDate} active={tilt.active} />
          {back}
          {tilt.active && <div className="post-card__glare" />}
        </div>
      </div>
    </div>
  );
}
