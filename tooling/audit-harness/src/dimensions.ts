// The DIMENSION axis (ADR-0233 / SPEC audit-harness-v2). A fixed, small set of audit LENSES (the
// WHAT) applied to each DOMAIN (the WHERE, ./domains.ts). New only when an ADR adds a lens — never
// discovered mid-run. A cell = (domain × applicable-dimension) = one finder shard; the matrix is
// SPARSE — a lens applies to a domain only if the domain's surface class warrants it.
//
// Pure data + a pure applicability function. No dispatch, no checker code (AGENTS.md boundary): the
// `checker` string names the lane the driver routes to; it is not run here.

import type { SurfaceClass } from "./domains.ts";

export type DimensionId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7" | "D8";

export interface Dimension {
  id: DimensionId;
  /** short slug — the finding `dimension` field carries the id, this is for the report/grid. */
  slug: string;
  /** what the lens hunts (one line). */
  hunts: string;
  /** the doctrine lane the driver dispatches (never run in-package). */
  checker: string;
}

/** The eight lenses, ranked risk × buyer-exposure × base-rate. */
export const DIMENSIONS: readonly Dimension[] = [
  {
    id: "D1",
    slug: "security-floor",
    hunts:
      "secrets-compare, shell-exec, auth/RLS, timing-safe, SSRF, injection, money-integer (the whole v1 harness content)",
    checker: "gw-security-auditor",
  },
  {
    id: "D2",
    slug: "secret-leakage",
    hunts:
      "hardcoded keys/tokens, private infra endpoints, ~/.gridwork refs, live URLs in files that ship",
    checker: "gw-security-auditor",
  },
  {
    id: "D3",
    slug: "customer-facing-quality",
    hunts:
      "copy/README/package.json metadata/inline comments: no gridwork-isms, no session/ADR shorthand, no jargon, no TODO/FIXME, professional tone (docs/shipped-source-quality-rubric.md); error messages as buyer UX",
    checker: "gw-code-reviewer",
  },
  {
    id: "D4",
    slug: "internal-vs-sold-leak",
    hunts:
      "internal-only refs leaking into shipped surfaces: operator names, private infra paths, internal repo/ADR/session refs, apps/admin·tooling·infra mentions in sold or oss source",
    checker: "gw-code-reviewer",
  },
  {
    id: "D5",
    slug: "license-tier-correctness",
    hunts:
      "SPDX header + LICENSE file + no-depend-up matches declared tier; mirror self-containment (no commercial dep in the Apache set)",
    checker: "standards-gate",
  },
  {
    id: "D6",
    slug: "docs-vs-code-truthfulness",
    hunts:
      "claims in docs/site/READMEs match built reality (the security/page.tsx static-export lie class)",
    checker: "gw-code-reviewer",
  },
  {
    id: "D7",
    slug: "hygiene-residue",
    hunts:
      "dead code + dead flags, orphaned dirs, dependency-hygiene/supply-chain, versioning + changelog coherence",
    checker: "haiku recon + standards-gate",
  },
  {
    id: "D8",
    slug: "visual-quality",
    hunts:
      "rendered-surface craft on the Nielsen rubric: visual hierarchy, spacing/alignment, type scale, contrast and focus states, interaction and motion honesty, empty/error states — the lens the retired design-critic ledger carried; `apps/*` domains only (ADR-0411)",
    checker: "gw-frontend-designer",
  },
];

const BY_ID = new Map(DIMENSIONS.map((d) => [d.id, d]));

/** Look up a dimension by id (throws on an unknown id — a caller/data bug, fail-loud). */
export function dimension(id: DimensionId): Dimension {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`dimensions: unknown dimension id "${id}"`);
  return d;
}

/**
 * Which lenses apply to a domain of the given surface class (the sparse matrix). Mostly class-driven
 * per the SPEC "Applies to" column, with two domain-keyed riders (D5, D8) where class alone is the
 * wrong axis:
 *  - oss-source / sold-source  → the seven SOURCE lenses D1-D7 (buyers read the source; it is a
 *                                package with a README).
 *  - buyer-runtime             → all but D5 (not a distributed package, so no license tier to be
 *                                wrong about; D4 is output-only).
 *  - internal-only             → the mechanical + hygiene lenses (D1/D2/D6/D7); no buyer-facing
 *                                copy (D3) or internal-leak (D4) lens — there is no shipped surface.
 *                                D5 (license-tier correctness — SPDX header/LICENSE/no-depend-up)
 *                                only re-applies when the domain IS a package (`domainId` starts
 *                                with "packages/", e.g. the reviewed INTERNAL_COMMERCIAL_PKGS): a
 *                                workflow yaml or a root doc has no license tier to be wrong about,
 *                                so D5 stays a dead cell there (SPEC "Applies to: all packages +
 *                                oss-mirror" — never a bare non-package internal-only domain).
 *  - D8 (visual-quality, ADR-0411) is keyed on the DOMAIN, not the class, for the same reason D5 is:
 *    it grades a RENDERED surface, and surface class does not track "has a UI". It applies to
 *    `apps/*` and nothing else — which deliberately CROSSES the class boundary in both directions.
 *    `apps/admin` is `internal-only` (operator control-plane) but is a real rendered UI the retired
 *    design-critic ledger audited, so it keeps the lens; `services/*` are `buyer-runtime` but are
 *    backend APIs with nothing to render, so a class-keyed D8 would have manufactured four dead
 *    cells there while silently dropping admin. A package tree has nothing to render either.
 * Every class resolves to a NON-EMPTY set. D8 is never the only lens a domain carries.
 */
export function applicableDimensions(
  cls: SurfaceClass,
  domainId?: string,
): DimensionId[] {
  // D8 rides on the domain, not the class — see the doc comment. `apps/*` only.
  const visual: DimensionId[] = domainId?.startsWith("apps/") ? ["D8"] : [];
  switch (cls) {
    case "oss-source":
    case "sold-source":
      return ["D1", "D2", "D3", "D4", "D5", "D6", "D7", ...visual];
    case "buyer-runtime":
      return ["D1", "D2", "D3", "D4", "D6", "D7", ...visual];
    case "internal-only":
      return domainId?.startsWith("packages/")
        ? ["D1", "D2", "D5", "D6", "D7"]
        : ["D1", "D2", "D6", "D7", ...visual];
  }
}
