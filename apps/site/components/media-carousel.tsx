"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";

import { CodeBlock, Icon } from "@/components";
import { BundleCompositionSlide } from "@/components/marketplace-hero-artifact";
import { MarketplaceDiagram } from "@/components/marketplace-diagrams";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { PokeEmbed } from "@/components/poke-embed";
import type { ComponentKey, MediaSlide } from "@/lib/media-manifest";

import styles from "./media-carousel.module.css";

// The `component` slides (ADR-0308 full-depth) — each a real kit/module surface rendered live. All
// are client-only (ssr: false) so the commercial-tier trees never bloat the shared bundle, and lazy
// so nothing loads until its slide renders. Keyed by ComponentKey so the manifest stays the single
// source of which module shows which surface.
const COMPONENT_SLIDES: Record<ComponentKey, ComponentType> = {
  "ui-pro": dynamic(() => import("./ui-pro-demo"), {
    ssr: false,
    loading: () => <MediaPlaceholder icon="boxes" />,
  }),
  "audit-worm": dynamic(() => import("./audit-worm-demo"), {
    ssr: false,
    loading: () => <MediaPlaceholder icon="boxes" />,
  }),
  "ai-meter": dynamic(() => import("./ai-meter-demo"), {
    ssr: false,
    loading: () => <MediaPlaceholder icon="boxes" />,
  }),
  "prompt-registry": dynamic(() => import("./prompt-registry-demo"), {
    ssr: false,
    loading: () => <MediaPlaceholder icon="boxes" />,
  }),
  "local-store": dynamic(() => import("./local-store-demo"), {
    ssr: false,
    loading: () => <MediaPlaceholder icon="boxes" />,
  }),
  credits: dynamic(() => import("./credits-demo"), {
    ssr: false,
    loading: () => <MediaPlaceholder icon="boxes" />,
  }),
};

// The interactive poke slides (ADR-0378 lock 2) no longer load here. They render from apps/demos
// through a same-origin iframe (ADR-0400), which is why this file no longer imports a single
// @caisson-sh/* module package: the lazy-load map that used to sit at this spot is now
// apps/demos/components/poke/registry.tsx, alongside the components it loads.

function Slide({ slide }: { slide: MediaSlide }) {
  switch (slide.kind) {
    case "diagram":
      if (slide.compositionBundle) {
        return <BundleCompositionSlide bundleId={slide.compositionBundle} />;
      }
      return slide.diagram ? <MarketplaceDiagram name={slide.diagram} /> : null;
    case "poke":
      // `key` is load-bearing, not cosmetic. PokeEmbed owns iframe state — the load verdict, the
      // measured height, and a ResizeObserver bound to THAT document's <body>. The card viewer
      // keeps one dialog subtree mounted across entries (preview-dialog.tsx heldVm), so without a
      // key React reuses the instance and only swaps `src`: the observer stays attached to the
      // destroyed document (the next poke never re-measures and gets clipped by `overflow:
      // hidden`), and a terminal `unavailable` from one module would name a module that was never
      // requested. A different module is a different document, never the same one re-pointed.
      return slide.poke ? (
        <PokeEmbed key={slide.poke} module={slide.poke} />
      ) : null;
    case "component": {
      if (!slide.component) return null;
      const ComponentSlide = COMPONENT_SLIDES[slide.component];
      return <ComponentSlide />;
    }
    case "code-artifact":
      return slide.artifact ? (
        <CodeBlock
          frame
          label={slide.artifact.file}
          code={slide.artifact.code}
        />
      ) : null;
    case "image":
      return <MediaPlaceholder {...(slide.icon ? { icon: slide.icon } : {})} />;
  }
}

/**
 * The media carousel (ADR-0285 §3) — renders an entry's ordered <MediaSlide>s (authored diagram,
 * produced video, live demo, or brand placeholder) in the card viewer and the module depth pages. A
 * single-slide entry renders the slide alone with no chrome; a multi-slide entry adds prev/next, a
 * dot indicator, a caption, and arrow-key navigation. The whole region is a labelled group, and the
 * caption is a polite live region so a screen reader hears the slide change.
 */
export function MediaCarousel({
  slides,
  label,
}: {
  slides: readonly MediaSlide[];
  label: string;
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  // Clamp when the slide set changes (a different entry opened in the shared viewer).
  useEffect(() => {
    setIndex(0);
  }, [slides]);

  const current = slides[Math.min(index, count - 1)];
  if (!current) return null;

  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  if (count === 1) {
    return (
      <div className={styles.single}>
        <Slide slide={current} />
        {current.caption ? (
          <p className={styles.caption}>{current.caption}</p>
        ) : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- arrow-key nav is delegated: it only fires via bubbling from the already-focusable prev/next <button>s below, never makes this group itself a tab stop
    <div
      className={styles.carousel}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={(e) => {
        // A poke slide owns its keyboard interaction (ADR-0378): arrow keys inside a [data-poke]
        // subtree drive the poke's inputs, never slide navigation.
        if ((e.target as HTMLElement).closest?.("[data-poke]")) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
      }}
    >
      <div className={styles.stage}>
        <div className={styles.stageContent}>
          <Slide slide={current} />
        </div>
        <button
          type="button"
          className={`${styles.nav} ${styles.prev}`}
          aria-label="Previous slide"
          onClick={() => go(-1)}
        >
          <span className={styles.flip}>
            <Icon name="arrow" />
          </span>
        </button>
        <button
          type="button"
          className={`${styles.nav} ${styles.next}`}
          aria-label="Next slide"
          onClick={() => go(1)}
        >
          <Icon name="arrow" />
        </button>
      </div>

      <div className={styles.footer}>
        <p className={styles.caption} role="status" aria-live="polite">
          {current.caption}
        </p>
        {/* Dots + the page count travel as ONE non-wrapping cluster, so the controls read
            identically at every viewport (the count digit was clipping off when the row wrapped). */}
        <div className={styles.controls}>
          <div className={styles.dots} aria-hidden="true">
            {slides.map((s, i) => (
              <button
                key={`${s.kind}-${i}`}
                type="button"
                className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
                onClick={() => setIndex(i)}
                tabIndex={-1}
              />
            ))}
          </div>
          <span className={styles.count}>
            {Math.min(index, count - 1) + 1} / {count}
          </span>
        </div>
      </div>
    </div>
  );
}
