"use client";

import { useEffect } from "react";

// Plausible analytics init (ADR-0118): a typed npm package (`@plausible-analytics/tracker`)
// instead of the prior raw `<Script src="https://plausible.io/js/script.js">` tag, env-gated on
// `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` — a no-op (renders nothing, fires no network request) when
// unset, the same pattern every other provider port follows. Cookieless, no consent banner
// (ADR-0118). `init()` is dynamically imported inside `useEffect` rather than at module top level
// — the tracker reads `window`/`location` at import time and throws under SSR if evaluated on the
// server; a client-only effect guarantees it only ever runs in the browser, after mount.
export function PlausibleInit() {
  useEffect(() => {
    const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
    if (domain === undefined || domain.length === 0) return;
    let cancelled = false;
    void import("@plausible-analytics/tracker").then(({ init }) => {
      if (cancelled) return;
      init({ domain, outboundLinks: true, fileDownloads: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
