import { Icon, StatusChip } from "@caisson/ui/components";
import type { IconName, StatusChipTone } from "@caisson/ui/components";

import { ADR_CEILING, ADR_TRAIL, FORKS_BOARD } from "@/lib/adr-trail";

// The data is read from the repo tree and baked into the build (see adr-trail.ts) — the standalone
// image ships no repo, so this page is fully static. Nothing here touches the network or the fs at
// request time.
export const dynamic = "force-static";

// ADR status → the three StatusChip tones (accent | success | muted). accepted decisions read
// "success"; a hard operator lock reads "accent"; a still-proposed ADR stays muted.
const STATUS_TONE: Record<string, StatusChipTone> = {
  accepted: "success",
  locked: "accent",
  proposed: "muted",
};

// A forks-board `##` section is either the live Open fork, or a locked/closed decision round.
function roundGlyph(section: string): {
  glyph: IconName;
  state: "ready" | "locked";
} {
  return /^Open\b/i.test(section)
    ? { glyph: "circle-dot", state: "ready" }
    : { glyph: "lock", state: "locked" };
}

export default function DecisionsPage() {
  // Newest ADR first — the operator scans recent decisions; the baked array is ascending by number.
  const trail = [...ADR_TRAIL].reverse();
  const { intro, openSummary, openRows, sections } = FORKS_BOARD;

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · admin · decisions</p>
        <h1 className="page-title" style={{ maxWidth: "20ch" }}>
          The decisions record, rendered from the record.
        </h1>
        <p className="lede">
          The append-only ADR trail and the live forks board — read straight
          from <span className="mono">knowledge/decisions</span> and{" "}
          <span className="mono">docs/state/decisions-and-forks.md</span> at
          build time. The control-plane is itself the source of truth it
          describes.
        </p>
        <div className="row" style={{ marginTop: "var(--cs-space-6)" }}>
          <span className="badge">{ADR_TRAIL.length} ADRs</span>
          <span className="badge">
            ceiling · ADR-{String(ADR_CEILING).padStart(4, "0")}
          </span>
          <span className="badge">{sections.length} decision rounds</span>
        </div>
      </section>

      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">ADR trail</h2>
        <p className="muted" style={{ fontSize: "var(--cs-text-sm)" }}>
          Every architecture decision, append-only, newest first — number,
          title, and status.
        </p>
        {trail.length === 0 ? (
          <div className="panel">
            <p className="panel-blurb">
              No ADRs baked into this build — the repo tree was not present at
              build time.
            </p>
          </div>
        ) : (
          <ul className="board">
            {trail.map((e) => (
              <li key={e.number} className="board-row">
                <div className="board-link is-static board-link--adr-row">
                  <span className="mono muted board-num">
                    ADR-{String(e.number).padStart(4, "0")}
                  </span>
                  <span className="board-main">
                    <span className="board-title">{e.title}</span>
                  </span>
                  <span className="board-chip">
                    <StatusChip
                      label={e.status || "—"}
                      tone={STATUS_TONE[e.status] ?? "muted"}
                    />
                  </span>
                  <span className="mono muted board-date">{e.date ?? ""}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Forks board</h2>
        {intro ? <p className="muted">{intro}</p> : null}

        <div className="panel is-rec">
          <div className="panel-head">
            <h3>Open forks</h3>
            <StatusChip
              label={openSummary ? "live" : "unread"}
              tone="accent"
              icon="circle-dot"
            />
          </div>
          {openRows.length > 0 ? (
            <ul className="fork-rows">
              {openRows.map((row) => (
                // No stable id in the source table — the item text (row[0]) is itself the
                // natural unique key, same reasoning as the AppShell nav-label fix above.
                <li key={row[0]} className="fork-row">
                  <span className="fork-row-item">{row[0]}</span>
                  {row[1] ? (
                    <span className="fork-row-state muted">{row[1]}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-blurb">
              {openSummary ||
                "Forks board not present at build time — nothing baked."}
            </p>
          )}
        </div>

        {sections.length > 0 ? (
          <ul className="board">
            {sections.map((section) => {
              const { glyph, state } = roundGlyph(section);
              return (
                <li key={section} className="board-row">
                  <div className="board-link is-static">
                    <span className="board-glyph" data-state={state}>
                      <Icon name={glyph} />
                    </span>
                    <span className="board-main">
                      <span className="board-title">{section}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
