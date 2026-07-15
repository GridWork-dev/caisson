"use client";

// Doors With Weight — the lazy impl (ADR-0334 moment 5). Interruptible springs, imperative,
// over the server-rendered door cards: the hovered door LIFTS with real spring physics, the
// sibling settles back a touch, and leaving retargets both home MID-FLIGHT with velocity
// carried across the retarget — that carry-over is the "weight". Lineage: Vercel Ship magnet ·
// Stripe Connect cubes. Transform-only (translate/scale — the ADR-0307 floor); hover-driven
// only, never keyboard-initiated (the focus ring stays still by design).
//
// ponytail: hand-rolled damped harmonic oscillator (~40 lines) instead of framer-motion's
// animate() — two nodes × two values doesn't justify re-splitting the shared framer runtime
// across a second async entry (measured: it pushed the framer-bearing lazy set from 42.6 to
// 73.1 KiB gzip, past the ADR-0334 §7 ≤60 ceiling). The Living Chain stays the repo's ONE
// framer-bearing component; this integrator is the same spring math, velocity included.

interface SpringParams {
  stiffness: number;
  damping: number;
}

const LIFT: SpringParams = { stiffness: 340, damping: 22 };
const SETTLE: SpringParams = { stiffness: 240, damping: 28 };

/** One spring-driven value; retarget() mid-flight keeps current position AND velocity. */
class Spring {
  value: number;
  private velocity = 0;
  private target: number;
  private params: SpringParams = SETTLE;

  constructor(initial: number) {
    this.value = initial;
    this.target = initial;
  }

  retarget(target: number, params: SpringParams): void {
    this.target = target;
    this.params = params;
  }

  /** Advance by dt seconds; returns true while still moving. */
  step(dt: number): boolean {
    const displacement = this.value - this.target;
    const accel =
      -this.params.stiffness * displacement -
      this.params.damping * this.velocity;
    this.velocity += accel * dt;
    this.value += this.velocity * dt;
    if (Math.abs(this.velocity) < 0.001 && Math.abs(displacement) < 0.001) {
      this.value = this.target;
      this.velocity = 0;
      return false;
    }
    return true;
  }
}

interface DoorSprings {
  el: HTMLElement;
  y: Spring;
  scale: Spring;
}

export function attachDoorWeight(container: HTMLElement): () => void {
  const doors: DoorSprings[] = Array.from(
    container.querySelectorAll<HTMLElement>("[data-door]"),
  ).map((el) => ({ el, y: new Spring(0), scale: new Spring(1) }));
  if (doors.length === 0) return () => {};

  let raf = 0;
  let last = 0;

  function frame(now: number): void {
    // Clamp dt: a background-tab gap must not integrate as one huge explosive step.
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    let moving = false;
    for (const d of doors) {
      const m1 = d.y.step(dt);
      const m2 = d.scale.step(dt);
      d.el.style.transform = `translateY(${d.y.value.toFixed(2)}px) scale(${d.scale.value.toFixed(4)})`;
      if (m1 || m2) moving = true;
    }
    raf = moving ? requestAnimationFrame(frame) : 0;
  }

  function kick(): void {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function onEnter(hovered: DoorSprings): void {
    hovered.y.retarget(-6, LIFT);
    hovered.scale.retarget(1.008, LIFT);
    for (const d of doors) {
      if (d !== hovered) {
        d.y.retarget(2, SETTLE);
        d.scale.retarget(0.995, SETTLE);
      }
    }
    kick();
  }

  function onLeave(): void {
    for (const d of doors) {
      d.y.retarget(0, SETTLE);
      d.scale.retarget(1, SETTLE);
    }
    kick();
  }

  const cleanups = doors.map((d) => {
    const enter = () => onEnter(d);
    d.el.addEventListener("pointerenter", enter);
    d.el.addEventListener("pointerleave", onLeave);
    return () => {
      d.el.removeEventListener("pointerenter", enter);
      d.el.removeEventListener("pointerleave", onLeave);
    };
  });

  return () => {
    if (raf) cancelAnimationFrame(raf);
    for (const fn of cleanups) fn();
    for (const d of doors) d.el.style.transform = "";
  };
}
