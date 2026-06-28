"use client";

import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { StatusChip, Terminal } from "@/components";

// Signature hero motion (ADR-0078 §6): the fail-closed RLS denial reveals line-by-line.
// Fully tokenized (--cs-duration-*, --cs-ease-reveal), transform/opacity only, no loop.
// Accessibility: the lines render in a <pre> with their text present from first paint, so
// screen readers and no-JS clients get the full denial; the reveal is layered on top via JS.
// prefers-reduced-motion → content shown immediately, no transition.

// useLayoutEffect on the client arms the hidden state BEFORE paint (no flash); on the server
// it must be a no-op effect to avoid the SSR warning. Pre-hydration markup is fully visible,
// which keeps the artifact safe when JS never runs.
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// The real fail-closed denial — ERROR/DETAIL tinted danger, "fail-closed" tinted accent.
const LINES: readonly ReactNode[] = [
  <>
    <span className="cs-tok-muted">$</span> psql -c &quot;select * from
    invoices&quot;
  </>,
  <span className="cs-tok-danger">
    ERROR: permission denied for table invoices
  </span>,
  <span className="cs-tok-danger">
    DETAIL: RLS policy &quot;tenant_isolation&quot; forbids SELECT
  </span>,
  <>
    {"        with no app.tenant set — "}
    <span className="cs-tok-accent">fail-closed</span>
    {" by default."}
  </>,
];

const STAGGER_MS = 90;

export function HomeHeroMotion() {
  // `armed` engages the hidden start state (only when motion is allowed); `play` releases it.
  const [armed, setArmed] = useState(false);
  const [play, setPlay] = useState(false);

  useIsoLayoutEffect(() => {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return; // stay visible, never animate
    setArmed(true); // hide before the browser paints → no flash
  }, []);

  useEffect(() => {
    if (!armed) return;
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, [armed]);

  const hidden = armed && !play;

  return (
    <Terminal
      label="psql"
      status={<StatusChip tone="accent" dot label="RLS fail-closed" />}
    >
      {LINES.map((line, i) => {
        const style: CSSProperties = {
          display: "block",
          opacity: hidden ? 0 : 1,
          transform: hidden ? "translateY(0.45em)" : "translateY(0)",
          transition: armed
            ? "opacity var(--cs-duration-slow) var(--cs-ease-reveal), transform var(--cs-duration-slow) var(--cs-ease-reveal)"
            : undefined,
          transitionDelay: armed ? `${i * STAGGER_MS}ms` : undefined,
          willChange: armed ? "opacity, transform" : undefined,
        };
        return (
          // Static, ordered lines that never reorder — the index is a stable key.
          <span key={i} style={style}>
            {line}
          </span>
        );
      })}
    </Terminal>
  );
}
