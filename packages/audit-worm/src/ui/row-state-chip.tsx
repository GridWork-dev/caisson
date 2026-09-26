// The per-row six-state verification chip (per-row verification SPEC). Shared by ChainViewer (T-U2)
// and ProofPanel (T-U1) so the state -> label/glyph mapping never drifts between them.
//
// FREEZE GUARD (Kickoff S): `@caisson-sh/ui` is frozen this wave, and its `StatusChip` ships only three
// tones (`accent | success | muted`) — NOT the positive/critical/warning/info names the PLAN's freeze
// guard assumed. So the six states are mapped onto those three tones, and the DISTINCTION between them
// is carried by the label + glyph, never colour alone (which is also the a11y-correct contract the
// component documents). A genuinely-new tone would be a `@caisson-sh/ui` change, blocked by the freeze.
import { StatusChip } from "@caisson-sh/ui/components";
import type { IconName, StatusChipTone } from "@caisson-sh/ui/components";
import type { RowState } from "@caisson-sh/kernel/audit-verify";

/** `server-asserted` is not a kernel row state — it labels a verdict the SERVER returned that the
 *  client could NOT independently recompute (e.g. a missing anchor), kept visibly distinct from a
 *  locally-verified one (the deliberate verified-locally-vs-server-asserted distinction, M3). */
export type ChipState = RowState | "server-asserted";

const CHIP: Record<
  ChipState,
  { tone: StatusChipTone; icon: IconName; label: string }
> = {
  verified: { tone: "success", icon: "shield", label: "Verified" },
  "anchor-confirmed-original-not-disclosed": {
    tone: "muted",
    icon: "lock",
    label: "Anchor confirmed",
  },
  tampered: { tone: "accent", icon: "alert-triangle", label: "Tampered" },
  unverifiable: { tone: "muted", icon: "alert", label: "Unverifiable" },
  pending: { tone: "muted", icon: "circle-dot", label: "Checking" },
  genesis: { tone: "accent", icon: "check", label: "Chain root" },
  "server-asserted": { tone: "muted", icon: "info", label: "Server-asserted" },
};

export function RowStateChip({
  state,
  provenance,
}: {
  state: ChipState;
  provenance?: "server-asserted";
}) {
  const c = CHIP[state];
  return (
    <StatusChip
      tone={c.tone}
      icon={c.icon}
      label={
        provenance === "server-asserted"
          ? `${c.label} — server asserted`
          : c.label
      }
      dot
    />
  );
}
