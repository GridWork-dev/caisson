import { HeroFieldCanvas } from "./hero-field-canvas";
import styles from "./hero-field.module.css";

// Homepage signature piece — the ambient depth-fog lattice field (ADR-0306, executes ADR-0078 §6).
// Server component: it ALWAYS renders the static poster (a CSS depth gradient + an inline-SVG lattice
// suggestion + a waterline hairline), then layers the client canvas over it. The whole layer is
// aria-hidden + pointer-events:none and absolutely positioned BEHIND the hero content, so it adds
// zero CLS and never becomes the LCP element (no <img>/background-image URL — text stays the LCP).
//
// The poster is the authored rest-frame every visitor sees: mobile, reduced-motion, and no-WebGL
// users get exactly this, never a blank or degraded scene. Desktop + motion-OK visitors get the
// three.js field faded in over it after idle (HeroFieldCanvas).

// Faint blueprint columns — evenly spaced vertical hairlines, faded top+bottom by the fog mask.
const LATTICE_LINES = Array.from({ length: 15 }, (_, i) => {
  const x = ((i + 0.5) / 15) * 1440;
  // A small deterministic top offset breaks the perfect grid into an engineered-but-organic read.
  const y1 = 60 + ((i * 37) % 90);
  return { x, y1 };
});

export function HeroField() {
  return (
    <div className={styles.field} aria-hidden="true">
      <div className={styles.poster} />
      <svg
        className={styles.posterSvg}
        viewBox="0 0 1440 760"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="cs-hero-fog" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="black" />
            <stop offset="0.12" stopColor="white" />
            <stop offset="0.82" stopColor="white" />
            <stop offset="1" stopColor="black" />
          </linearGradient>
          <mask id="cs-hero-fogmask">
            <rect width="1440" height="760" fill="url(#cs-hero-fog)" />
          </mask>
        </defs>
        <g mask="url(#cs-hero-fogmask)">
          {LATTICE_LINES.map((l) => (
            <line
              key={l.x}
              className={styles.latticeLine}
              x1={l.x}
              y1={l.y1}
              x2={l.x}
              y2={720}
            />
          ))}
          {/* Waterline hairline + one accent segment at rest (the scan-line the canvas animates).
              Placed in the upper-right hero band where it reads over open space, not the headline. */}
          <line
            className={styles.waterline}
            x1="760"
            y1="330"
            x2="1440"
            y2="330"
          />
          <line
            className={styles.accentSeg}
            x1="980"
            y1="330"
            x2="1180"
            y2="330"
          />
        </g>
      </svg>
      <HeroFieldCanvas />
      <div className={styles.scrim} />
      {/* Waterline Descent (ADR-0334 moment 2): scroll-scrubbed depth layer — rests invisible. */}
      <div className={styles.depth} />
    </div>
  );
}
