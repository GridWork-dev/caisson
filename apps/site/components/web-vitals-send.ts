"use client";

// Web-vitals field capture (Kickoff-S task 7 — no field data existed; ADR-0334 §7 evidence).
// Lazy-loaded HALF of the pair: components/web-vitals-report.tsx mounts a ~0.3 KiB shim in first
// load and dynamic-imports this module after the window `load` event, so the `web-vitals`
// library (already in the lockfile via posthog-js) stays OUT of first-load JS — the library
// reads buffered PerformanceObserver entries, so late registration still sees LCP/FCP/TTFB.
//
// Marketing stays cookieless (ADR-0118): no posthog-js SDK here, no storage, no cookies — one
// anonymous fire-and-forget beacon per metric batch to the PostHog capture endpoint the CSP
// already allowlists, with $process_person_profile:false (no person profile is ever created).
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";

interface VitalsBatch {
  [key: string]: string | number | boolean;
}

export function startWebVitals(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // env-gated, same contract as posthog-init.tsx
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  // One anonymous id per pageview — deliberately NOT persisted anywhere (cookieless floor).
  const pageviewId = crypto.randomUUID();
  const batch: VitalsBatch = {};
  let flushed = false;

  function record(metric: Metric): void {
    batch[`$web_vitals_${metric.name}_value`] = metric.value;
    batch[`$web_vitals_${metric.name}_rating`] = metric.rating;
  }

  // PostHog's standard $web_vitals event shape so the built-in Web Vitals dashboard reads it.
  function flush(): void {
    if (flushed || Object.keys(batch).length === 0) return;
    flushed = true;
    const body = JSON.stringify({
      api_key: key,
      event: "$web_vitals",
      distinct_id: pageviewId,
      properties: {
        ...batch,
        $process_person_profile: false,
        $current_url: window.location.href,
        $pathname: window.location.pathname,
        $lib: "caisson-web-vitals",
      },
      timestamp: new Date().toISOString(),
    });
    // sendBeacon survives the unload the flush rides on; the fetch fallback is fire-and-forget
    // (keepalive) — never awaited, never blocks INP. fetchWithTimeout is a server-side helper;
    // a beacon at pagehide has no timeout semantics to manage.
    if (!navigator.sendBeacon(`${host}/capture/`, body)) {
      void fetch(`${host}/capture/`, {
        method: "POST",
        body,
        keepalive: true,
      }).catch(() => {
        /* telemetry is best-effort — never surface */
      });
    }
  }

  onLCP(record);
  onCLS(record);
  onINP(record);
  onFCP(record);
  onTTFB(record);

  // Flush once when the page is hidden (the web-vitals-recommended lifecycle point — CLS/INP
  // finalize then); pagehide covers browsers that skip visibilitychange on unload.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}
