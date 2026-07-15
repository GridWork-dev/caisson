"use client";

import { useEffect } from "react";

// Doors With Weight (ADR-0334 moment 5) — first-load shim. The impl module drives
// interruptible springs imperatively over the SERVER-rendered door cards (the hero's HTML/LCP
// contract is untouched; this component renders nothing). It bears NO motion library — a
// hand-rolled integrator (see lib/doors-with-weight-impl.ts) keeps the Living Chain the repo's
// only framer-bearing component and the §7 chunk ceiling green. Gates before the lazy chunk is
// even requested: real hover pointer + no-reduced-motion + browser idle after load — mobile and
// reduced-motion visitors never download it (same idiom as hero-field-canvas.tsx).
export function DoorsWithWeight() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionOk = window.matchMedia(
      "(prefers-reduced-motion: no-preference)",
    );
    if (!fine.matches || !motionOk.matches) return;

    let cancelled = false;
    let detach: (() => void) | null = null;
    let idleId = 0;
    const timers: number[] = [];

    async function mount(): Promise<void> {
      if (cancelled) return;
      const container = document.querySelector<HTMLElement>("[data-doors]");
      if (!container) return;
      const { attachDoorWeight } = await import("@/lib/doors-with-weight-impl");
      if (cancelled) return;
      detach = attachDoorWeight(container);
    }

    function scheduleIdle(): void {
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
      detach?.();
    };
  }, []);

  return null;
}
