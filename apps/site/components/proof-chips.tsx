import { StatusChip, type IconName } from "@/components";

// A wrapping row of self-contained proof chips (ADR-0285 §4). Unlike a "·"-separated strip — whose
// last item orphans onto its own line when it wraps — each chip is a complete pill, so a wrap reads
// as intentional, never as a dangling fragment. Presentational, server-safe. Reused by the evidence
// hero (fixing the orphaned "S3 Object-Lock proofs") and the homepage install card.
export function ProofChips({
  items,
  icon = "check",
  tone = "muted",
  note,
}: {
  items: readonly string[];
  icon?: IconName;
  tone?: "muted" | "success" | "accent";
  /** Optional trailing note on its own full-width row (muted). */
  note?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--cs-space-2)",
        alignItems: "center",
      }}
    >
      {items.map((it) => (
        <StatusChip key={it} label={it} tone={tone} icon={icon} />
      ))}
      {note ? (
        <span
          className="cs-footnote"
          style={{ flexBasis: "100%", marginTop: "var(--cs-space-1)" }}
        >
          {note}
        </span>
      ) : null}
    </div>
  );
}
