"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { Icon } from "@/components";
import { MarketplaceDiagram } from "@/components/marketplace-diagrams";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { MediaVideo } from "@/components/media-video";
import type { MediaSlide } from "@/lib/media-manifest";

import styles from "./media-carousel.module.css";

// The ui-pro live demo — client-only (ssr: false) so the commercial-tier tree never bloats the
// shared bundle, and lazy so nothing loads until an interactive slide renders.
const UiProDemo = dynamic(() => import("./ui-pro-demo"), {
  ssr: false,
  loading: () => <MediaPlaceholder icon="boxes" />,
});

function Slide({ slide }: { slide: MediaSlide }) {
  switch (slide.kind) {
    case "diagram":
      return slide.diagram ? <MarketplaceDiagram name={slide.diagram} /> : null;
    case "video":
      return slide.src ? (
        <MediaVideo
          src={slide.src}
          {...(slide.poster !== undefined ? { poster: slide.poster } : {})}
        />
      ) : null;
    case "interactive":
      return <UiProDemo />;
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
    <div
      className={styles.carousel}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={(e) => {
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
        <Slide slide={current} />
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
  );
}
