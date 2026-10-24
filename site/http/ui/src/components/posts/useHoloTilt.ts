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
  private stiffness = FOLLOW.stiffness;
  private damping = FOLLOW.damping;
  private invMass = 1;
  private invMassRecovery = 0;

  constructor(
    value: number,
    private readonly precision = 0.01,
  ) {
    this.value = this.last = this.target = value;
  }

  to(target: number, cfg: SpringConfig, soft = 0) {
    this.target = target;
    this.stiffness = cfg.stiffness;
    this.damping = cfg.damping;
    if (soft > 0) {
      // start with infinite mass and recover over `soft` seconds, so the
      // change of direction eases in instead of jerking
      this.invMass = 0;
      this.invMassRecovery = 1 / (soft * 60);
    } else {
      // a pointer driving the card again gets full response right away
      this.invMass = 1;
    }
  }

  /** Advances by `dt` frames; returns false once settled on the target. */
  step(dt: number): boolean {
    this.invMass = Math.min(this.invMass + this.invMassRecovery, 1);
    const delta = this.target - this.value;
    const velocity = (this.value - this.last) / dt;
    const acceleration =
      (this.stiffness * delta - this.damping * velocity) * this.invMass;
    const d = (velocity + acceleration) * dt;
    this.last = this.value;
    if (Math.abs(d) < this.precision && Math.abs(delta) < this.precision) {
      this.value = this.last = this.target;
      return false;
    }
    this.value += d;
    return true;
  }
}

function makeSprings() {
  return {
    rotateX: new Spring(0),
    rotateY: new Spring(0),
    glareX: new Spring(50),
    glareY: new Spring(50),
    glareO: new Spring(0, 0.001),
    backgroundX: new Spring(50),
    backgroundY: new Spring(50),
    scale: new Spring(1, 0.0005),
    lift: new Spring(0),
  };
}

type Springs = ReturnType<typeof makeSprings>;

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

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Writes the spring state into the CSS custom properties the card reads. */
function paint(el: HTMLElement, s: Springs) {
  const gx = s.glareX.value;
  const gy = s.glareY.value;
  const st = el.style;
  st.setProperty("--pointer-x", `${round(gx)}%`);
  st.setProperty("--pointer-y", `${round(gy)}%`);
  st.setProperty("--pointer-from-left", `${round(gx / 100)}`);
  st.setProperty("--pointer-from-top", `${round(gy / 100)}`);
  // light direction from the card centre, -1..1 (drives the photo relief)
  st.setProperty("--light-x", `${round(clamp((gx - 50) / 50, -1, 1))}`);
  st.setProperty("--light-y", `${round(clamp((gy - 50) / 50, -1, 1))}`);
  st.setProperty("--card-opacity", `${round(clamp(s.glareO.value, 0, 1))}`);
  st.setProperty("--rotate-x", `${round(s.rotateX.value)}deg`);
  st.setProperty("--rotate-y", `${round(s.rotateY.value)}deg`);
  st.setProperty("--background-x", `${round(s.backgroundX.value)}%`);
  st.setProperty("--background-y", `${round(s.backgroundY.value)}%`);
  st.setProperty("--card-scale", `${round(s.scale.value, 4)}`);
  st.setProperty("--translate-y", `${round(s.lift.value)}px`);
}

/**
 * Spring-driven tilt + light tracking for a holo card. Returns a ref for the
 * card root (receives the CSS variables) and pointer handlers for the
 * interactive surface. `active` is true from the first pointer move until
 * the card has fully settled back to rest, so effect layers can be mounted
 * only while they are visible.
 */
export function useHoloTilt<T extends HTMLElement>() {
  const cardRef = useRef<T>(null);
  const springs = useRef<Springs>(makeSprings());
  const frame = useRef<number | null>(null);
  const lastTime = useRef(0);
  const leaveTimer = useRef<number | null>(null);
  const resting = useRef(true);
  const [active, setActive] = useState(false);

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
      s.backgroundX.to(adjust(px, 0, 100, 37, 63), FOLLOW);
      s.backgroundY.to(adjust(py, 0, 100, 33, 67), FOLLOW);
      s.scale.to(still ? 1 : 1.05, LIFT);
      s.lift.to(still ? 0 : -6, LIFT);
      kick();
    },
    [kick],
  );

  const onPointerLeave = useCallback(() => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      resting.current = true;
      const s = springs.current;
      s.rotateX.to(0, SETTLE, 0.6);
      s.rotateY.to(0, SETTLE, 0.6);
      s.glareX.to(50, SETTLE, 0.6);
      s.glareY.to(50, SETTLE, 0.6);
      s.glareO.to(0, FADE, 0.6);
      s.backgroundX.to(50, SETTLE, 0.6);
      s.backgroundY.to(50, SETTLE, 0.6);
      s.scale.to(1, LIFT);
      s.lift.to(0, LIFT);
      kick();
    }, LEAVE_DELAY_MS);
  }, [kick]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    },
    [],
  );

  return { cardRef, active, onPointerMove, onPointerLeave };
}
