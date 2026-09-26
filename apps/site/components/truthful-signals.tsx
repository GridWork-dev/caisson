import Link from "next/link";

import { Icon } from "@/components";
import type { TruthfulSignal } from "@/lib/trust-signals";

/** The shared truthful-signals row (ADR-0374 lock 2) — reuses the already-shipping chip-as-`<Link>`
 *  pattern (`preview-dialog.tsx`'s module-family-membership badges already render `<Link
 *  className="cs-chip">`) so this adds zero new CSS and zero new component primitive. No
 *  `tone="accent"` on any chip — that budget stays reserved for the real primary CTA (ADR-0078 §8). */
export function TruthfulSignals({
  signals,
  lead,
}: {
  signals: readonly TruthfulSignal[];
  lead?: string;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--cs-space-2)" }}>
      {lead ? (
        <p className="cs-footnote" style={{ margin: 0 }}>
          {lead}
        </p>
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--cs-space-2)",
          alignItems: "center",
        }}
        aria-label="Verifiable facts about Caisson"
      >
        {signals.map((s) => (
          <Link
            key={s.key}
            href={s.href}
            className="cs-chip"
            style={{ textDecoration: "none" }}
          >
            <Icon name={s.icon} /> {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
