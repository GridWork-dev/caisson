"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components";
import {
  formatUsd,
  MODULE_PRICES,
  PERSONA_BUNDLE_IDS,
  type BundleId,
} from "@/lib/pricing";

import { BUNDLE_ICON, bundleLabel } from "./marketplace";
import styles from "./marketplace.module.css";

// A2 (ADR-0310): StackBuilder is a below-fold client island (useCart, per-keystroke running
// total) that was hydrating at t0 along with everything above it. Two moves:
//   1. `next/dynamic(..., { ssr:false })` — the in-repo poster pattern media-carousel.tsx already
//      uses for its component slides — so the real (heavy) component's chunk is never in the
//      initial client bundle.
//   2. Don't even RENDER the dynamic import until the browser goes idle after load — same
//      `requestIdleCallback` + `setTimeout` fallback hero-field-canvas.tsx uses for the three.js
//      scene — so mounting StackBuilder never competes with the page's own hydration for main-
//      thread time. It's already below the fold, so "idle" alone (no separate viewport observer)
//      is the simpler sufficient signal: by the time a visitor scrolls this far, idle has almost
//      always long since fired.
//
// The `loading` poster below is the picker's own RESTING markup (nothing selected — a first
// mount's real starting state), reusing the same `marketplace.module.css` classes and pricing
// data stack-builder.tsx renders, so swapping the poster for the hydrated component is a no-op
// layout-wise: no CLS.

const RealStackBuilder = dynamic(
  () => import("./stack-builder").then((m) => m.StackBuilder),
  { ssr: false, loading: () => <StackBuilderPoster /> },
);

// Mirrors stack-builder.tsx's PICKER_GROUPS grouping (kept minimal + duplicated rather than
// exported from that file, which this task doesn't own — re-sync here if that grouping changes).
const POSTER_GROUPS: readonly {
  key: string;
  label: string;
  icon: (typeof BUNDLE_ICON)[BundleId];
  modules: readonly (typeof MODULE_PRICES)[number][];
}[] = [
  ...PERSONA_BUNDLE_IDS.map((b) => ({
    key: b,
    label: bundleLabel(b),
    icon: BUNDLE_ICON[b],
    modules: MODULE_PRICES.filter((m) => m.bundles[0] === b),
  })),
  {
    key: "platform",
    label: "Platform",
    icon: "boxes" as const,
    modules: MODULE_PRICES.filter((m) => m.bundles.length === 0),
  },
].filter((g) => g.modules.length > 0);

/** The static, non-interactive resting-state markup — same DOM shape and content as a real
 * `<StackBuilder>` with nothing selected, so it carries the identical layout height. */
function StackBuilderPoster() {
  return (
    <div className={styles.build}>
      <div className={styles.picker}>
        {POSTER_GROUPS.map((g) => (
          <fieldset key={g.key} className={styles.pickerGroup}>
            <legend className={styles.pickerLegend}>
              <Icon name={g.icon} />
              {g.label}
            </legend>
            {g.modules.map((m) => (
              <label key={m.id} className={styles.pickerRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  disabled
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <span className={styles.pickerMain}>
                  <span
                    className="cs-card-title"
                    style={{ fontSize: "var(--cs-text-base)" }}
                  >
                    {m.label}
                  </span>
                  <span
                    className="cs-muted"
                    style={{
                      fontSize: "var(--cs-text-sm)",
                      lineHeight: "var(--cs-leading-snug)",
                    }}
                  >
                    {m.blurb}
                  </span>
                </span>
                <span className={`cs-num ${styles.pickerPrice}`}>
                  {formatUsd(m.amount)}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      <aside className={styles.rail} aria-label="Your stack">
        <span className={styles.railTitle}>Your stack</span>
        <div className={styles.railEmpty}>
          <Icon name="inbox" size="lg" />
          <p>
            No modules selected yet. Pick modules on the left to see the running
            total — and any bundle that would cover them for less.
          </p>
        </div>
      </aside>
    </div>
  );
}

/** requestIdleCallback with a setTimeout fallback (Safari) — same shape as hero-field-canvas's
 * `scheduleIdle`. Returns a cancel function. */
function scheduleIdle(run: () => void): () => void {
  const ric = (
    window as unknown as {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
    }
  ).requestIdleCallback;
  if (ric) {
    const id = ric(run, { timeout: 2000 });
    const cic = (
      window as unknown as { cancelIdleCallback?: (id: number) => void }
    ).cancelIdleCallback;
    return () => cic?.(id);
  }
  const id = window.setTimeout(run, 200);
  return () => window.clearTimeout(id);
}

export function StackBuilderLazy() {
  const [ready, setReady] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cancelRef.current = scheduleIdle(() => setReady(true));
    return () => cancelRef.current?.();
  }, []);

  return ready ? <RealStackBuilder /> : <StackBuilderPoster />;
}
