import { useCallback, useRef, useState } from "react";
import { Modal } from "@mui/material";
import type { NotFoundPost } from "./useNotFoundPosts";
import {
  prefersReducedMotion,
  useHoloTilt,
  type HoloPose,
  type Placement,
} from "./useHoloTilt";
import HoloCard from "./HoloCard";
import CardBack from "./CardBack";
import "./PostCardShowcase.css";

interface Props {
  post: NotFoundPost;
  foundDate?: string;
  /** the grid card this one pops out of, and lands back on */
  origin: HTMLElement;
  /** its tilt and light at that moment, so the motion carries on */
  pose: HoloPose;
  onClosed: () => void;
}

const CENTRE: Placement = { x: 0, y: 0, scale: 1 };

/** How to place a card laid out at `to` so it covers `from`. */
function placementOver(from: DOMRect, to: DOMRect): Placement {
  return {
    x: from.left + from.width / 2 - (to.left + to.width / 2),
    y: from.top + from.height / 2 - (to.top + to.height / 2),
    scale: from.width / to.width,
  };
}

/**
 * The card popped out of the grid: it flies from its slot to the middle of
 * the screen, growing and spinning once (the back shows mid-spin), and can
 * be turned over. Closing flies it back into its slot.
 */
export default function PostCardShowcase({
  post,
  foundDate,
  origin,
  pose,
  onClosed,
}: Readonly<Props>) {
  const tilt = useHoloTilt<HTMLDivElement>({ lift: false, initial: pose });
  const { cardRef, place, flyTo, turnTo, release, whenRested } = tilt;
  // degrees the card is turned to; multiples of 360 show the front
  const turn = useRef(0);
  const [flipped, setFlipped] = useState(false);
  // a solved card's back shows the emblem until it's turned over by hand
  const [details, setDetails] = useState(false);
  const [closing, setClosing] = useState(false);

  // Lift off from the grid slot, spinning once on the way to the middle.
  // Runs once the card is mounted (the modal renders it through a portal).
  const launch = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    // keyboard focus on the card itself, so Enter and Space turn it over
    card
      .querySelector<HTMLElement>(".post-card__rotator")
      ?.focus({ preventScroll: true });
    if (prefersReducedMotion()) return;
    place(
      placementOver(origin.getBoundingClientRect(), card.getBoundingClientRect()),
      0,
    );
    turn.current = 360;
    flyTo(CENTRE, turn.current);
    release();
  }, [cardRef, origin, place, flyTo, release]);

  const turnOver = useCallback(() => {
    if (closing) return;
    setDetails(true);
    setFlipped((f) => !f);
    turn.current += 180;
    if (prefersReducedMotion()) place(CENTRE, turn.current);
    else turnTo(turn.current);
  }, [closing, place, turnTo]);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const card = cardRef.current;
    if (!card || prefersReducedMotion()) {
      onClosed();
      return;
    }
    // land face up: unwind the opening spin, or finish turning from the back
    turn.current += flipped ? 180 : -360;
    release();
    flyTo(
      placementOver(origin.getBoundingClientRect(), card.getBoundingClientRect()),
      turn.current,
    );
    whenRested(onClosed);
  }, [closing, cardRef, flipped, origin, release, flyTo, whenRested, onClosed]);

  return (
    <Modal
      open
      onClose={close}
      hideBackdrop
      // the grid card takes focus back itself once it is visible again
      disableRestoreFocus
      aria-label={post.title}
    >
      <div
        className={`post-card-showcase${closing ? " is-closing" : ""}`}
        data-tier={post.tier}
        tabIndex={-1}
      >
        <div className="post-card-showcase__backdrop" onClick={close} />
        <div className="post-card-showcase__stage">
          <HoloCard
            post={post}
            foundDate={foundDate}
            tilt={tilt}
            className="post-card-showcase__card"
            label="Перевернуть карточку"
            onMount={launch}
            onActivate={turnOver}
            interactive={!closing}
            flipped={flipped}
            back={
              <CardBack
                post={post}
                foundDate={foundDate}
                details={details}
                active={tilt.active}
              />
            }
          />
          <div className="post-card-showcase__controls">
            <button
              type="button"
              className="post-card-showcase__button"
              aria-label="Перевернуть"
              title="Перевернуть"
              onClick={turnOver}
            >
              ↻
            </button>
            <button
              type="button"
              className="post-card-showcase__button"
              aria-label="Закрыть"
              title="Закрыть"
              onClick={close}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
