// The real-media counterpart to <MediaPlaceholder> (ADR-0263): a plain, self-hosted <video> for
// the one slot that has a produced asset. `prefers-reduced-motion` is a media query no HTML video
// attribute can read, so a client component checks it once on mount — reduced motion skips
// autoplay and holds on the poster frame; controls stay available either way (the user can always
// press play). Mirrors the `Reveal` component's reduced-motion check (packages/ui/src/components/reveal.tsx).
"use client";

import { useEffect, useState } from "react";

export interface MediaVideoProps {
  /** Same-origin asset under /public (e.g. "/videos/audit-worm-demo.mp4"). */
  src: string;
  /** CSS aspect-ratio of the container, e.g. "16 / 9" (default). Matches MediaPlaceholder's contract. */
  aspect?: string;
  /** Optional poster frame; shown before playback and whenever reduced motion holds it there. */
  poster?: string;
}

export function MediaVideo({ src, aspect, poster }: MediaVideoProps) {
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    setAutoPlay(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return (
    <video
      src={src}
      {...(poster !== undefined ? { poster } : {})}
      muted
      loop
      playsInline
      preload="metadata"
      controls
      autoPlay={autoPlay}
      style={{
        aspectRatio: aspect ?? "16 / 9",
        width: "100%",
        display: "block",
        borderRadius: "var(--cs-radius-lg)",
        border: "1px solid var(--cs-border)",
        background: "var(--cs-surface-2)",
      }}
    />
  );
}
