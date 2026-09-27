"use client";

import { useMemo, useState } from "react";

import {
  diffJson,
  diffLines,
  type JsonChange,
  type LineChange,
} from "../lib/diff.ts";

import "./diff-viewer.css";

interface DiffViewerCommon {
  /** Side-by-side ("split") or inline ("unified"). Default "split". */
  view?: "split" | "unified";
  beforeLabel?: string;
  afterLabel?: string;
  ariaLabel?: string;
}

export type DiffViewerProps = DiffViewerCommon &
  (
    | { kind?: "text"; before: string; after: string }
    | {
        kind: "json";
        before: unknown;
        after: unknown;
        /** Secret-bearing keys masked in BOTH panes before diffing (reuses `lib/redact`). */
        redactKeys?: ReadonlySet<string>;
      }
  );

/** Split a text line diff into aligned rows: a change block pairs its removes with its adds. */
interface TextRow {
  left?: LineChange | undefined;
  right?: LineChange | undefined;
}
function toRows(diff: LineChange[]): TextRow[] {
  const rows: TextRow[] = [];
  let i = 0;
  while (i < diff.length) {
    const d = diff[i]!;
    if (d.op === "same") {
      rows.push({ left: d, right: d });
      i++;
      continue;
    }
    const removes: LineChange[] = [];
    const adds: LineChange[] = [];
    while (i < diff.length && diff[i]!.op === "remove")
      removes.push(diff[i++]!);
    while (i < diff.length && diff[i]!.op === "add") adds.push(diff[i++]!);
    const max = Math.max(removes.length, adds.length);
    for (let k = 0; k < max; k++)
      rows.push({ left: removes[k], right: adds[k] });
  }
  return rows;
}

function fmt(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value);
}

const SIGN: Record<LineChange["op"], string> = {
  same: " ",
  add: "+",
  remove: "−",
};

/**
 * DiffViewer — a before/after diff for plain text (line-based LCS) or a JSON object (key-path walk),
 * in side-by-side or unified layout. Redaction-aware for JSON: secret-bearing keys are masked in both
 * panes via `lib/redact`, so a changed secret shows `[redacted] → [redacted]` and never leaks. All
 * diff math is the pure `lib/diff` (unit-tested, reusable server-side); this is presentation only.
 */
export function DiffViewer(props: DiffViewerProps) {
  const {
    view: initialView = "split",
    beforeLabel = "Before",
    afterLabel = "After",
    ariaLabel = "Difference",
  } = props;
  const [view, setView] = useState<"split" | "unified">(initialView);

  // Memo on the actual inputs, not the props object — a fresh props identity per render would
  // otherwise recompute both diffs every time.
  const { kind, before, after } = props;
  const redactKeys = props.kind === "json" ? props.redactKeys : undefined;
  const textDiff = useMemo(
    () =>
      kind === "json" ? null : diffLines(before as string, after as string),
    [kind, before, after],
  );
  const jsonDiff = useMemo<JsonChange[] | null>(
    () => (kind === "json" ? diffJson(before, after, redactKeys) : null),
    [kind, before, after, redactKeys],
  );

  return (
    <section className="cs-diff" aria-label={ariaLabel}>
      <div className="cs-diff__toolbar">
        <div className="cs-diff__labels" aria-hidden="true">
          <span>{beforeLabel}</span>
          <span>{afterLabel}</span>
        </div>
        <div className="cs-diff__views" role="group" aria-label="Diff layout">
          {(["split", "unified"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className="cs-diff__view-btn"
              data-active={v === view}
              aria-pressed={v === view}
              onClick={() => setView(v)}
            >
              {v === "split" ? "Split" : "Unified"}
            </button>
          ))}
        </div>
      </div>

      {textDiff ? (
        view === "split" ? (
          <TextSplit rows={toRows(textDiff)} />
        ) : (
          <TextUnified diff={textDiff} />
        )
      ) : jsonDiff ? (
        <JsonChanges changes={jsonDiff} view={view} />
      ) : null}
    </section>
  );
}

function TextSplit({ rows }: { rows: TextRow[] }) {
  return (
    <div className="cs-diff__grid cs-diff__grid--split" role="table">
      {rows.map((row, i) => (
        <div className="cs-diff__row" role="row" key={i}>
          <div
            className="cs-diff__cell"
            role="cell"
            data-op={row.left?.op ?? "empty"}
          >
            <span className="cs-diff__ln">{row.left?.beforeLine ?? ""}</span>
            <code>{row.left?.text ?? ""}</code>
          </div>
          <div
            className="cs-diff__cell"
            role="cell"
            data-op={row.right?.op ?? "empty"}
          >
            <span className="cs-diff__ln">{row.right?.afterLine ?? ""}</span>
            <code>{row.right?.text ?? ""}</code>
          </div>
        </div>
      ))}
    </div>
  );
}

function TextUnified({ diff }: { diff: LineChange[] }) {
  return (
    <div className="cs-diff__grid" role="table">
      {diff.map((line, i) => (
        <div className="cs-diff__uline" role="row" data-op={line.op} key={i}>
          <span className="cs-diff__sign" aria-hidden="true">
            {SIGN[line.op]}
          </span>
          <code>{line.text}</code>
        </div>
      ))}
    </div>
  );
}

function JsonChanges({
  changes,
  view,
}: {
  changes: JsonChange[];
  view: "split" | "unified";
}) {
  if (changes.length === 0) {
    return <p className="cs-diff__empty">No differences.</p>;
  }
  return (
    <div className="cs-diff__grid" role="table">
      {changes.map((c, i) =>
        view === "split" ? (
          <div className="cs-diff__row" role="row" key={i}>
            <div
              className="cs-diff__cell"
              role="cell"
              data-op={c.kind === "added" ? "empty" : "remove"}
            >
              <span className="cs-diff__path">{c.path}</span>
              <code>{fmt(c.before)}</code>
            </div>
            <div
              className="cs-diff__cell"
              role="cell"
              data-op={c.kind === "removed" ? "empty" : "add"}
            >
              <span className="cs-diff__path">{c.path}</span>
              <code>{fmt(c.after)}</code>
            </div>
          </div>
        ) : (
          <div className="cs-diff__json-change" role="row" key={i}>
            <span className="cs-diff__path">{c.path}</span>
            {c.kind !== "added" ? (
              <div className="cs-diff__uline" data-op="remove">
                <span className="cs-diff__sign" aria-hidden="true">
                  −
                </span>
                <code>{fmt(c.before)}</code>
              </div>
            ) : null}
            {c.kind !== "removed" ? (
              <div className="cs-diff__uline" data-op="add">
                <span className="cs-diff__sign" aria-hidden="true">
                  +
                </span>
                <code>{fmt(c.after)}</code>
              </div>
            ) : null}
          </div>
        ),
      )}
    </div>
  );
}
