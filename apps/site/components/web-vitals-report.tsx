"use client";

import { useEffect } from "react";

// First-load shim of the web-vitals pair (task 7) — the ONLY part that rides first-load JS
// (ADR-0334 §7: wave-wide first-load delta ≤ +2 KiB gzip). The real capture (web-vitals lib +
// beacon sender) lives in lib/web-vitals-send.ts and loads as a lazy chunk after `load`, when
// LCP has settled — web-vitals reads buffered performance entries, so nothing is missed.
export function WebVitalsReport() {
  useEffect(() => {
    let cancelled = false;
    async function start(): Promise<void> {
      if (cancelled) return;
      const { startWebVitals } = await import("@/lib/web-vitals-send");
      if (!cancelled) startWebVitals();
    }
    if (document.readyState === "complete") {
      void start();
    } else {
      const onLoad = () => void start();
      window.addEventListener("load", onLoad, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener("load", onLoad);
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
