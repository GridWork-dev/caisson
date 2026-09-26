"use client";

// The poke slide, as a same-origin iframe (ADR-0400). The interactive demos and the ~19 packages
// that drove them live in apps/demos now; this component is all that is left on the site side of
// the ADR-0378 poke program — a framed `/demos/embed/<module>` document, sized to its content,
// wearing the reader's theme.
//
// SAME ORIGIN IS THE WHOLE DESIGN. apps/site rewrites /demos/* to the demos service, so this
// iframe's document is caisson.sh as far as the browser is concerned. That is what lets the three
// things below work with no message protocol, no postMessage handshake, and no new CSP origin:
// reading the loaded document to tell a real embed from a 404, measuring its height to size the
// frame, and pushing a theme change into it. The rejected subdomain shape (ADR-0400 "Rejected")
// would have needed a hand-rolled protocol for each one.
//
// No `sandbox` attribute: on same-origin content `sandbox="allow-scripts allow-same-origin"` is
// the documented no-op (the frame can clear its own sandbox), so it would read as a guarantee it
// is not. The real containment is the demos app's own CSP — `connect-src 'self'`, which is the
// browser enforcing the trust line every poke prints.
import { useCallback, useEffect, useRef, useState } from "react";

import { MediaPlaceholder } from "@/components/media-placeholder";
import type { PokeKey } from "@/lib/media-manifest";

import styles from "./poke-embed.module.css";

/** The attribute apps/demos stamps on its embed documents (apps/demos/app/layout.tsx). */
const EMBED_MARKER = "pokeEmbed";

type LoadState = "pending" | "ready" | "unavailable";

/** The current theme as the site records it, or null when the reader has never chosen one. */
function currentTheme(): string | null {
  return document.documentElement.getAttribute("data-theme");
}

export function PokeEmbed({ module }: { module: PokeKey }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<LoadState>("pending");
  const [height, setHeight] = useState<number | null>(null);

  /** The embed document, or null when it is not ours to read (see `onLoad`). */
  const embedDoc = useCallback((): Document | null => {
    try {
      const doc = frameRef.current?.contentDocument ?? null;
      return doc?.documentElement.dataset[EMBED_MARKER] === "1" ? doc : null;
    } catch {
      // A cross-origin document. Structurally impossible under the multi-zone rewrite, so treat
      // it as "not our embed" rather than inventing a partial rendering path for it.
      return null;
    }
  }, []);

  /**
   * The embed's true content height — measured on <body>, NOT documentElement.
   *
   * `documentElement.scrollHeight` inside an iframe never falls below the iframe's own height, so
   * feeding it back into that height is a one-way ratchet: a poke that gets SHORTER (rotate the
   * key version and the rotation note disappears) leaves the frame stuck at its tallest past size
   * with dead space under it. Observed at 974px against 923px of content before this was measured
   * off <body>. apps/demos releases base.css's `min-height: 100dvh` on <body> for the same reason
   * — it would reintroduce exactly this floor one element down.
   *
   * The bounding rect rather than `body.scrollHeight`: scrollHeight is an integer that rounds
   * DOWN, which clips the last row by a pixel on a fractional layout.
   */
  const contentHeight = useCallback(
    (doc: Document): number =>
      Math.ceil(doc.body.getBoundingClientRect().height),
    [],
  );

  // Load verdict + content sizing + theme, all off the one load event. A load event alone cannot
  // be the verdict: BEFORE the /demos rewrite is armed, apps/site's own 404 page answers this URL
  // with a perfectly successful load. The embed marker is what distinguishes the two, and its
  // absence is exactly the pre-flip fail-safe state this PR ships in.
  const onLoad = useCallback(() => {
    const doc = embedDoc();
    if (!doc) {
      setState("unavailable");
      return;
    }
    const theme = currentTheme();
    if (theme) doc.documentElement.setAttribute("data-theme", theme);
    setHeight(contentHeight(doc));
    setState("ready");
  }, [embedDoc, contentHeight]);

  // The load event can land BEFORE React attaches `onLoad`. This component is server-rendered (a
  // client component, not `ssr: false`), so the HTML parser creates the iframe and starts its
  // navigation while the site bundle is still parsing — a warm cache reliably wins that race, and
  // `load` does not bubble, so the event fires into no listener and is gone. Nothing would ever
  // leave `pending`, which CSS renders as an INVISIBLE frame under a placeholder: the embed would
  // be loaded and interactive at `opacity: 0` with the reader looking at a grey box, and not even
  // the fallback text. An already-complete document is the same verdict, just observed late.
  //
  // The `about:blank` exclusion is the whole trick: a fresh iframe's document reports `complete`
  // BEFORE the real navigation commits, so `readyState` alone would fire this immediately, find no
  // marker, and latch `unavailable` on a poke that was about to load fine.
  //
  // NO TIMEOUT here, deliberately. A deadline is the obvious companion for "the load never fires
  // at all", and it is wrong on this component: `loading="lazy"` means a below-the-fold frame has
  // not started navigating yet and reports exactly the same not-settled state as a hung one, so a
  // timer would show the fallback for a demo that works and that the reader simply had not
  // scrolled to. Distinguishing the two needs viewport observation, which is a lot of machinery
  // for a case the fallback already covers the moment a real `load` or error lands.
  useEffect(() => {
    let settled: boolean;
    try {
      const doc = frameRef.current?.contentDocument;
      settled =
        !!doc && doc.readyState === "complete" && doc.URL !== "about:blank";
    } catch {
      // Cross-origin: the navigation has committed and `onLoad` would reach the same "not ours"
      // conclusion, so treat it as settled rather than waiting out the deadline.
      settled = true;
    }
    if (settled) onLoad();
  }, [onLoad]);

  // A poke changes height as you drive it (a verdict line appears, a rotation note comes and
  // goes), so the frame tracks the embed's own box for as long as it is mounted — in both
  // directions, which is the whole reason `contentHeight` measures what it measures.
  useEffect(() => {
    if (state !== "ready") return;
    const doc = embedDoc();
    if (!doc) return;
    const observer = new ResizeObserver(() => setHeight(contentHeight(doc)));
    observer.observe(doc.body);
    return () => observer.disconnect();
  }, [state, embedDoc, contentHeight]);

  // Theme is read once at load from the shared same-origin localStorage; this pushes LIVE toggles
  // in, so flipping the site theme with a module page open does not leave a dark panel in a light
  // page until the next navigation.
  useEffect(() => {
    if (state !== "ready") return;
    const observer = new MutationObserver(() => {
      const doc = embedDoc();
      const theme = currentTheme();
      if (doc && theme) doc.documentElement.setAttribute("data-theme", theme);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [state, embedDoc]);

  if (state === "unavailable") {
    return (
      <div className={styles.fallback} role="status">
        <p className={styles.fallbackText}>
          The interactive demo for <code>@caisson-sh/{module}</code> is
          unavailable. Everything it demonstrates is documented on this page.
        </p>
      </div>
    );
  }

  return (
    // `data-poke` marks the subtree exactly as the in-page poke did, so the carousel's arrow-key
    // handler still yields to it — reaching the frame by Tab and pressing an arrow must not
    // advance the slide. (Keys pressed INSIDE the frame never bubble out to begin with, which is
    // a small improvement on the in-page version this replaces.)
    <div className={styles.wrap} data-poke="">
      {state === "pending" ? (
        <div className={styles.pending}>
          <MediaPlaceholder icon="boxes" />
        </div>
      ) : null}
      <iframe
        ref={frameRef}
        className={styles.frame}
        data-state={state}
        src={`/demos/embed/${module}`}
        title={`@caisson-sh/${module} interactive demo`}
        loading="lazy"
        onLoad={onLoad}
        {...(height === null ? {} : { style: { height: `${height}px` } })}
      />
    </div>
  );
}
