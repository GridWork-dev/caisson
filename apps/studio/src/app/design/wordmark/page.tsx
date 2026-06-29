import { Glyph } from "@caisson/ui/components";

import { CONCEPTS } from "./marks";

/**
 * Wordmark — the mark candidates, rendered live for the operator pick (NOT auto-decided, the one
 * operator rule). Each concept keeps the caisson identity but is built at real craft — filled
 * two-tone steel + a glowing instrument light — versus the shipped 4-stroke glyph shown for contrast.
 * Once the operator locks one, it replaces the kit Glyph + favicon and the choice becomes an ADR.
 */
const SIZES = [
  { px: 64, label: "64 · app icon" },
  { px: 32, label: "32 · UI" },
  { px: 20, label: "20 · favicon" },
  { px: 16, label: "16 · tab" },
] as const;

export default function WordmarkPage() {
  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · wordmark</p>
        <h1 className="page-title" style={{ maxWidth: "22ch" }}>
          The mark, built properly.
        </h1>
        <p className="lede">
          Three high-craft takes on the caisson identity — a pressurized chamber
          under a cold waterline, holding a single instrument light. Filled
          two-tone steel and a real glow, not four outline strokes. Pick one; it
          becomes the kit mark, the favicon, and a locked ADR.
        </p>
      </section>

      {/* before — the shipped glyph */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Before · the shipped glyph</h2>
        <div
          className="panel row"
          style={{ gap: "var(--cs-space-8)", alignItems: "center" }}
        >
          <Glyph style={{ width: 64, height: 64 }} />
          <Glyph style={{ width: 20, height: 20 }} />
          <p className="muted" style={{ fontSize: "var(--cs-text-sm)" }}>
            Two open strokes — a waterline over a chamber. Legible, but reads as
            a wireframe, not a mark. This is what we are replacing.
          </p>
        </div>
      </section>

      {/* candidates — B "Pressure vessel" is the locked mark (ADR-0101); the rest stay for the record */}
      {CONCEPTS.map((c, i) => {
        const { Mark } = c;
        const locked = c.id === "vessel";
        return (
          <section
            key={c.id}
            className="stack"
            style={{ gap: "var(--cs-space-5)" }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 className="section-title">
                {String.fromCharCode(65 + i)} · {c.name}
              </h2>
              <span
                className="board-state mono"
                style={locked ? { color: "var(--cs-accent)" } : undefined}
              >
                {locked ? "locked · the mark" : "candidate"}
              </span>
            </div>
            <p className="muted" style={{ maxWidth: "64ch" }}>
              {c.blurb}
            </p>

            {/* hero — the mark at size, app icon on its tile + the UI lockup */}
            <div
              className="panel row"
              style={{
                gap: "var(--cs-space-8)",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Mark size={132} variant="app" title={`${c.name} mark`} />
              <div className="stack" style={{ gap: "var(--cs-space-4)" }}>
                <Mark size={92} variant="ui" />
                <span
                  className="mono muted"
                  style={{ fontSize: "var(--cs-text-xs)" }}
                >
                  ui · monochrome (accent is app-icon only)
                </span>
              </div>
            </div>

            <div className="cols">
              {/* app icon on dark + the size ladder */}
              <div className="panel stack" style={{ gap: "var(--cs-space-4)" }}>
                <span className="board-state mono">app icon · favicon</span>
                <div
                  className="row"
                  style={{ gap: "var(--cs-space-6)", alignItems: "flex-end" }}
                >
                  {SIZES.map((s) => (
                    <div
                      key={s.px}
                      className="stack"
                      style={{ gap: "var(--cs-space-2)", alignItems: "center" }}
                    >
                      <Mark
                        size={s.px}
                        variant="app"
                        title={`${c.name} mark`}
                      />
                      <span
                        className="mono muted"
                        style={{ fontSize: "var(--cs-text-xs)" }}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* in-UI mono + accent-light variant */}
              <div className="panel stack" style={{ gap: "var(--cs-space-4)" }}>
                <span className="board-state mono">in-product · lockup</span>
                <div
                  className="row"
                  style={{ gap: "var(--cs-space-6)", alignItems: "center" }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "var(--cs-space-3)",
                      fontFamily: "var(--cs-font-mono)",
                      fontWeight: "var(--cs-weight-medium)",
                      letterSpacing: "var(--cs-tracking-tight)",
                      fontSize: "var(--cs-text-2xl)",
                    }}
                  >
                    <Mark size={34} variant="ui" />
                    caisson
                  </span>
                </div>
                <div
                  className="row"
                  style={{
                    gap: "var(--cs-space-6)",
                    alignItems: "center",
                    color: "var(--cs-fg-muted)",
                  }}
                >
                  <Mark size={28} variant="mono" />
                  <span
                    className="mono"
                    style={{ fontSize: "var(--cs-text-sm)" }}
                  >
                    mono · on muted
                  </span>
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <hr className="divider" />
      <p className="muted" style={{ fontSize: "var(--cs-text-sm)" }}>
        Pick by silhouette at 16px first (the tab favicon is the hardest test),
        then by feel at 64. Say the letter — A · B · C — or ask for a blend;
        nothing locks until you call it.
      </p>
    </div>
  );
}
