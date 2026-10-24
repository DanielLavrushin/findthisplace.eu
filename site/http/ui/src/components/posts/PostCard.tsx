import { useCallback, useState } from "react";
import type { NotFoundPost } from "./useNotFoundPosts";
import { useHoloTilt, type HoloPose } from "./useHoloTilt";
import HoloCard from "./HoloCard";
import PostCardShowcase from "./PostCardShowcase";
import "./PostCard.css";

interface Props {
  post: NotFoundPost;
  foundDate?: string;
}

interface PoppedOut {
  origin: HTMLElement;
  pose: HoloPose;
}

export default function PostCard({
  post,
  foundDate,
}: Readonly<Props>) {
  const tilt = useHoloTilt<HTMLDivElement>();
  const { cardRef, snapshot, release } = tilt;
  // set while the card is popped out into the showcase
  const [popped, setPopped] = useState<PoppedOut | null>(null);

  const popOut = useCallback(() => {
    const origin = cardRef.current;
    if (!origin) return;
    setPopped({ origin, pose: snapshot() });
    // the showcase carries on from this pose; this one rests while hidden
    release();
  }, [cardRef, snapshot, release]);

  const putBack = useCallback(() => {
    setPopped(null);
    // back in its slot: focus returns to the card the dialog came from,
    // once it is visible again
    requestAnimationFrame(() =>
      cardRef.current
        ?.querySelector<HTMLElement>(".post-card__rotator")
        ?.focus({ preventScroll: true }),
    );
  }, [cardRef]);

  return (
    <>
      <HoloCard
        post={post}
        foundDate={foundDate}
        tilt={tilt}
        label={`Открыть карточку «${post.title}»`}
        onActivate={popOut}
        opensDialog
        className={popped ? "is-away" : undefined}
      />
      {popped && (
        <PostCardShowcase
          post={post}
          foundDate={foundDate}
          origin={popped.origin}
          pose={popped.pose}
          onClosed={putBack}
        />
      )}
    </>
  );
}
