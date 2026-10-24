import { useCallback, useEffect, useRef, useState } from "react";

interface SpringConfig {
  stiffness: number;
  damping: number;
}

// follow the pointer: quick but with a little overshoot
const FOLLOW: SpringConfig = { stiffness: 0.066, damping: 0.25 };
// scale/lift: slower, heavier
const LIFT: SpringConfig = { stiffness: 0.033, damping: 0.45 };
// drift back to rest after the pointer leaves: one soft overshoot
const SETTLE: SpringConfig = { stiffness: 0.012, damping: 0.1 };
// fade the light out without it bouncing back on
const FADE: SpringConfig = { stiffness: 0.02, damping: 0.3 };
// whole-card moves (pop-out flight, turning over): heavy, no overshoot
const FLIGHT: SpringConfig = { stiffness: 0.045, damping: 0.42 };
const TURN: SpringConfig = { stiffness: 0.05, damping: 0.4 };

// how long the card holds its pose after the pointer leaves
const LEAVE_DELAY_MS = 120;

/**
 * Damped spring, ported from svelte/motion's `spring` (the model
 * pokemon-cards-css drives its cards with). Time is measured in 60fps
 * frames, velocity in units per frame.
 */
class Spring {
  value: number;
  target: number;
  private last: number;
  private cfg = FOLLOW;
  // during a soft change: the previous spring, still acting while it hands
  // over to the new one
  private previous: { target: number; cfg: SpringConfig } | null = null;
  private handover = 1;
  private handoverRate = 0;

  constructor(
    value: number,
    private readonly precision = 0.01,
  ) {
    this.value = this.last = this.target = value;
  }

  to(target: number, cfg: SpringConfig, soft = 0) {
    if (soft > 0) {
      // Hand over from the current spring across `soft` seconds: the change
      // eases in, and motion already under way keeps being braked by the old
      // spring. (svelte's soft mode suspends every force instead, so a card
      // still swinging when the pointer leaves coasts far past the angles
      // the pointer itself can reach.)
      this.previous = { target: this.target, cfg: this.cfg };
      this.handover = 0;
      this.handoverRate = 1 / (soft * 60);
    } else {
      // a pointer driving the card again gets full response right away
      this.previous = null;
    }
    this.target = target;
    this.cfg = cfg;
  }

  /** Puts the spring at `value` at rest, without animating. */
  jump(value: number) {
    this.value = this.last = this.target = value;
    this.previous = null;
  }

  /** Advances by `dt` frames; returns false once settled on the target. */
  step(dt: number): boolean {
    const velocity = (this.value - this.last) / dt;
    let acceleration = this.pull(this.target, this.cfg, velocity);
    if (this.previous) {
      this.handover = Math.min(this.handover + this.handoverRate * dt, 1);
      const old = this.pull(this.previous.target, this.previous.cfg, velocity);
      acceleration = old + (acceleration - old) * this.handover;
      if (this.handover === 1) this.previous = null;
    }
    const d = (velocity + acceleration) * dt;
    this.last = this.value;
    if (
      Math.abs(d) < this.precision &&
      Math.abs(this.target - this.value) < this.precision
    ) {
      this.value = this.last = this.target;
      this.previous = null;
      return false;
    }
    this.value += d;
    return true;
  }

  private pull(target: number, cfg: SpringConfig, velocity: number) {
    return cfg.stiffness * (target - this.value) - cfg.damping * velocity;
  }
}

/** Where the tilt and the light are; enough for another card to take over. */
export interface HoloPose {
  rotateX: number;
  rotateY: number;
  glareX: number;
  glareY: number;
  glareO: number;
}

/** Offset (px) and scale of the whole card from where it is laid out. */
export interface Placement {
  x: number;
  y: number;
  scale: number;
}

function makeSprings(initial?: HoloPose) {
  return {
    rotateX: new Spring(initial?.rotateX ?? 0),
    rotateY: new Spring(initial?.rotateY ?? 0),
    glareX: new Spring(initial?.glareX ?? 50),
    glareY: new Spring(initial?.glareY ?? 50),
    glareO: new Spring(initial?.glareO ?? 0, 0.001),
    // whole-card springs settle within half a pixel / degree, so a landing
    // card counts as arrived once it visibly has
    scale: new Spring(1, 0.001),
    translateX: new Spring(0, 0.5),
    translateY: new Spring(0, 0.5),
    // turning the card over (degrees around its vertical axis)
    turn: new Spring(0, 0.5),
  };
}

type Springs = ReturnType<typeof makeSprings>;

function clamp(val: number, min = 0, max = 100) {
  return Math.min(Math.max(val, min), max);
}

function round(val: number, precision = 3) {
  return Number.parseFloat(val.toFixed(precision));
}

export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Writes the spring state into the CSS custom properties the card reads. */
function paint(el: HTMLElement, s: Springs) {
  // The light overshoots with its spring; keep it on the card. The foil
  // gradients are positioned from it, and past the card's edge they would
  // slide their own edges into view.
  const gx = clamp(s.glareX.value);
  const gy = clamp(s.glareY.value);
  const st = el.style;
  st.setProperty("--pointer-x", `${round(gx)}%`);
  st.setProperty("--pointer-y", `${round(gy)}%`);
  st.setProperty("--pointer-from-left", `${round(gx / 100)}`);
  st.setProperty("--pointer-from-top", `${round(gy / 100)}`);
  // 0 when looking straight at the card, 1 at the edges (steepest tilt)
  st.setProperty(
    "--pointer-from-center",
    `${round(clamp(Math.hypot(gx - 50, gy - 50) / 50, 0, 1))}`,
  );
  // light direction from the card centre, -1..1 (drives the photo relief)
  st.setProperty("--light-x", `${round((gx - 50) / 50)}`);
  st.setProperty("--light-y", `${round((gy - 50) / 50)}`);
  st.setProperty("--card-opacity", `${round(clamp(s.glareO.value, 0, 1))}`);
  st.setProperty("--rotate-x", `${round(s.rotateX.value)}deg`);
  st.setProperty("--rotate-y", `${round(s.rotateY.value)}deg`);
  st.setProperty("--card-scale", `${round(s.scale.value, 4)}`);
  st.setProperty("--translate-x", `${round(s.translateX.value)}px`);
  st.setProperty("--translate-y", `${round(s.translateY.value)}px`);
  st.setProperty("--turn", `${round(s.turn.value)}deg`);
}

interface HoloTiltOptions {
  /** lift the card and scale it up a little while it's hovered */
  lift?: boolean;
  /** tilt and light to start from, e.g. taking over from another card */
  initial?: HoloPose;
}

/**
 * Spring-driven tilt + light tracking for a holo card. Returns a ref for the
 * card root (receives the CSS variables) and pointer handlers for the
 * interactive surface. `active` is true from the first pointer move until
 * the card has fully settled back to rest, so effect layers can be mounted
 * only while they are visible. The whole card can also be moved, scaled and
 * turned over (`place`, `flyTo`, `turnTo`), which the showcase uses.
 */
export function useHoloTilt<T extends HTMLElement>({
  lift = true,
  initial,
}: HoloTiltOptions = {}) {
  const cardRef = useRef<T>(null);
  const springs = useRef<Springs>(makeSprings(initial));
  const frame = useRef<number | null>(null);
  const lastTime = useRef(0);
  const leaveTimer = useRef<number | null>(null);
  const resting = useRef(true);
  const restListener = useRef<(() => void) | null>(null);
  // a card taking over a lit pose shows its effects until the light fades
  const [active, setActive] = useState(() => (initial?.glareO ?? 0) > 0.01);

  const tick = useCallback((now: number) => {
    // dt in 60fps frames; capped so a backgrounded tab doesn't explode it
    const dt = clamp(((now - lastTime.current) * 60) / 1000, 0.25, 4);
    lastTime.current = now;
    let moving = false;
    for (const spring of Object.values(springs.current)) {
      moving = spring.step(dt) || moving;
    }
    if (cardRef.current) paint(cardRef.current, springs.current);
    if (moving) {
      frame.current = requestAnimationFrame(tick);
    } else {
      frame.current = null;
      if (resting.current) setActive(false);
      const listener = restListener.current;
      restListener.current = null;
      listener?.();
    }
  }, []);

  const kick = useCallback(() => {
    if (frame.current !== null) return;
    lastTime.current = performance.now();
    frame.current = requestAnimationFrame(tick);
  }, [tick]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const card = cardRef.current;
      if (!card) return;
      if (leaveTimer.current !== null) {
        clearTimeout(leaveTimer.current);
        leaveTimer.current = null;
      }
      resting.current = false;
      setActive(true);

      // measure against the untransformed root so the tilt itself doesn't
      // feed back into the pointer position
      const rect = card.getBoundingClientRect();
      const px = clamp((100 / rect.width) * (e.clientX - rect.left));
      const py = clamp((100 / rect.height) * (e.clientY - rect.top));
      const still = prefersReducedMotion();

      const s = springs.current;
      s.rotateX.to(still ? 0 : round(-(px - 50) / 3.5), FOLLOW);
      s.rotateY.to(still ? 0 : round((py - 50) / 3.5), FOLLOW);
      s.glareX.to(px, FOLLOW);
      s.glareY.to(py, FOLLOW);
      s.glareO.to(1, FOLLOW);
      if (lift) {
        s.scale.to(still ? 1 : 1.05, LIFT);
        s.translateY.to(still ? 0 : -6, LIFT);
      }
      kick();
    },
    [kick, lift],
  );

  /** Lets the tilt and the light settle back to rest. */
  const release = useCallback(() => {
    resting.current = true;
    const s = springs.current;
    s.rotateX.to(0, SETTLE, 0.6);
    s.rotateY.to(0, SETTLE, 0.6);
    s.glareX.to(50, SETTLE, 0.6);
    s.glareY.to(50, SETTLE, 0.6);
    s.glareO.to(0, FADE, 0.6);
    if (lift) {
      s.scale.to(1, LIFT);
      s.translateY.to(0, LIFT);
    }
    kick();
  }, [kick, lift]);

  const onPointerLeave = useCallback(() => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      release();
    }, LEAVE_DELAY_MS);
  }, [release]);

  /** Puts the whole card somewhere at once, painted before the next frame. */
  const place = useCallback((p: Placement, turn: number) => {
    const s = springs.current;
    s.translateX.jump(p.x);
    s.translateY.jump(p.y);
    s.scale.jump(p.scale);
    s.turn.jump(turn);
    if (cardRef.current) paint(cardRef.current, s);
  }, []);

  /** Flies the whole card to `p`, turning it to `turn` degrees on the way. */
  const flyTo = useCallback(
    (p: Placement, turn: number) => {
      const s = springs.current;
      s.translateX.to(p.x, FLIGHT);
      s.translateY.to(p.y, FLIGHT);
      s.scale.to(p.scale, FLIGHT);
      s.turn.to(turn, FLIGHT);
      kick();
    },
    [kick],
  );

  /** Turns the card over to `deg` (multiples of 360 show the front). */
  const turnTo = useCallback(
    (deg: number) => {
      springs.current.turn.to(deg, TURN);
      kick();
    },
    [kick],
  );

  /** Calls `listener` once every spring has come to rest. */
  const whenRested = useCallback(
    (listener: () => void) => {
      restListener.current = listener;
      kick();
    },
    [kick],
  );

  const snapshot = useCallback((): HoloPose => {
    const s = springs.current;
    return {
      rotateX: s.rotateX.value,
      rotateY: s.rotateY.value,
      glareX: s.glareX.value,
      glareY: s.glareY.value,
      glareO: s.glareO.value,
    };
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    },
    [],
  );

  return {
    cardRef,
    active,
    onPointerMove,
    onPointerLeave,
    release,
    place,
    flyTo,
    turnTo,
    whenRested,
    snapshot,
  };
}

export type HoloTilt<T extends HTMLElement> = ReturnType<typeof useHoloTilt<T>>;
