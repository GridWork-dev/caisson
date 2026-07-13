"use client";

import { useEffect, useRef } from "react";

import styles from "./hero-field.module.css";
import type { FieldHandle } from "./hero-field-scene";

// The imperative client mount for the depth-fog lattice field (ADR-0306). It renders one transparent
// <canvas> over the server poster and hydrates the three.js scene ONLY when every gate holds:
//   viewport ≥1024px · prefers-reduced-motion: no-preference · browser idle after load.
// The heavy scene is a dynamic import() — the ssr:false, home-route-only lazy chunk ADR-0306 §3
// budgets at ≤130KB gzip. Because the import fires only inside the passed gate, mobile and
// reduced-motion visitors NEVER download it; they keep the poster. (dynamic import() is the
// imperative-three equivalent of `next/dynamic({ ssr:false })`, which wraps React components — the
// scene is a plain module, so it is import()-ed directly, same client-only lazy-chunk outcome.)

function effectiveDark(): boolean {
  const pinned = document.documentElement.dataset.theme;
  if (pinned === "dark") return true;
  if (pinned === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function HeroFieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Gate: desktop width + motion allowed. Fail either → poster stays, no chunk requested.
    const lg = window.matchMedia("(min-width: 1024px)");
    const motionOk = window.matchMedia(
      "(prefers-reduced-motion: no-preference)",
    );
    if (!lg.matches || !motionOk.matches) return;

    let handle: FieldHandle | null = null;
    let cancelled = false;
    let idleId = 0;
    const timers: number[] = [];

    // The RAF loop runs only when BOTH hold — the hero on-screen AND the tab visible. Each
    // observer flips its own flag and syncs; a lone `resume()` per source would let a tab
    // switch restart the loop while the hero is scrolled away (last-writer-wins burn).
    let onScreen = true;
    let docVisible = !document.hidden;
    function syncRunState() {
      if (!handle) return;
      if (onScreen && docVisible) handle.resume();
      else handle.pause();
    }

    const io =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              onScreen = entry?.isIntersecting ?? true;
              syncRunState();
            },
            { threshold: 0 },
          )
        : null;

    function onVisibility() {
      docVisible = !document.hidden;
      syncRunState();
    }
    // Waterline Descent (ADR-0334 §3a): feed hero scroll-exit progress into the fog uniform.
    // Passive listener, one clamped division — the RAF loop consumes the value; no extra paints.
    function onScroll() {
      if (!handle) return;
      const heroH = canvas?.parentElement?.clientHeight || 1;
      handle.setDescent(window.scrollY / heroH);
    }
    function onContextLost(e: Event) {
      // GPU dropped the context — tear down to the poster (ADR-0306 resilience).
      e.preventDefault();
      handle?.dispose();
      handle = null;
      canvas?.removeAttribute("data-active");
    }
    const themeObserver = new MutationObserver(() => {
      handle?.setDark(effectiveDark());
    });
    // System-theme parity: with no pinned data-theme, an OS-level flip recolors the CSS poster
    // via prefers-color-scheme but nothing re-stamps the attribute — listen to the mq directly.
    const schemeMq = window.matchMedia("(prefers-color-scheme: dark)");
    function onSchemeChange() {
      handle?.setDark(effectiveDark());
    }

    async function mount() {
      if (cancelled || !canvas) return;
      const { mountDepthField } = await import("./hero-field-scene");
      if (cancelled) return;
      handle = mountDepthField(canvas, effectiveDark());
      if (!handle) return; // no WebGL — poster stays
      canvas.setAttribute("data-active", ""); // CSS fades the canvas in over the poster
      canvas.addEventListener("webglcontextlost", onContextLost);
      io?.observe(canvas);
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll(); // seed descent for a mid-page hydrate (deep link / restored scroll)
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      schemeMq.addEventListener("change", onSchemeChange);
    }

    function scheduleIdle() {
      if (cancelled) return;
      const ric = (
        window as unknown as {
          requestIdleCallback?: (
            cb: () => void,
            opts?: { timeout: number },
          ) => number;
        }
      ).requestIdleCallback;
      if (ric) idleId = ric(() => void mount(), { timeout: 2000 });
      else timers.push(window.setTimeout(() => void mount(), 200));
    }

    // Wait until AFTER load (LCP settled) before even scheduling idle work.
    if (document.readyState === "complete") scheduleIdle();
    else window.addEventListener("load", scheduleIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", scheduleIdle);
      const cic = (
        window as unknown as { cancelIdleCallback?: (id: number) => void }
      ).cancelIdleCallback;
      if (idleId && cic) cic(idleId);
      for (const t of timers) clearTimeout(t);
      io?.disconnect();
      themeObserver.disconnect();
      schemeMq.removeEventListener("change", onSchemeChange);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      handle?.dispose();
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
  );
}
