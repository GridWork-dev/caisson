/** Shared SVG-label sizing helpers for the authored diagram grammars (marketplace-diagrams +
 *  schematics). Extracted so the two files can't drift on the clamp math (SHIP review P3-3). */

/** Approximate mono advance width (em) — 0.72 leaves margin over the measured ~0.69 render
 *  (and over JetBrains Mono's nominal 0.6) so a fallback-font paint never overflows. */
export const CHAR_W = 0.72;

/** SVG `textLength` clamp: squeeze a label that would paint past its box instead of overflowing
 *  it. A label that fits renders untouched — authored copy should always fit; the clamp is
 *  overflow insurance, never a layout tool. */
export function fit(
  text: string,
  fontPx: number,
  maxW: number,
): { textLength: number; lengthAdjust: "spacingAndGlyphs" } | undefined {
  return text.length * fontPx * CHAR_W > maxW
    ? { textLength: maxW, lengthAdjust: "spacingAndGlyphs" }
    : undefined;
}
