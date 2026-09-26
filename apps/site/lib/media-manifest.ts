// The per-entry media manifest (ADR-0290, refining ADR-0285 §3): each bundle/module resolves to an
// ordered list of media slides the <MediaCarousel> renders — in both the card viewer and the module
// depth pages. Pure data (no React): a slide is a DESCRIPTOR; the carousel maps a descriptor to a
// node. Content preference per item, honest-artifact floor (ADR-0082 — every slide depicts SHIPPED
// behaviour, never a fabricated screen):
//   1. `component` — the actual @caisson/ui / @caisson/ui-pro component the item ships, rendered
//      live with static sample data (server-safe/presentational only — a slide never pulls
//      interactive state).
//   2. `code-artifact` — the item's real depth-page artifact (lib/module-pages.ts, single-sourced),
//      rendered via the same framed <CodeBlock> the homepage's honest-artifact section uses.
//   3. `diagram` — an authored mechanism/composition diagram (inline SVG / token-CSS) for
//      concept-only items with neither a showable component nor an artifact. Bundle slides use the
//      parametrized composition pattern (one component, fed each bundle's real member modules).
// Where none of those apply, the brand placeholder auto-fills slide 1 — never a fabricated
// screenshot. All 33 catalog items resolve to real media (ADR-0290/0378) — the placeholder path stays as
// the defensive fallback for a future catalog item not yet wired in.
import type { IconName } from "@caisson/ui/components";

import { BUNDLE_MARKS, moduleMark } from "./marks";
import { MODULE_PAGES } from "./module-pages";
import { type BundleId, BUNDLES, isBundleId } from "./catalog";

export type SlideKind =
  | "diagram"
  | "poke"
  | "component"
  | "code-artifact"
  | "image";

/** The interactive "poke" slides (ADR-0378 lock 2) — the one slide kind that genuinely owns
 *  interactive state: a deterministic in-browser run of the module's shipped mechanism (real
 *  WebCrypto / the package's own pure math, golden-pinned), with a tamper control and the
 *  client-side trust line. All 26 pokes shipped; ui-pro is exempt —
 *  its live component slide IS its poke. */
export type PokeKey =
  | "field-crypto"
  | "audit-worm"
  | "ai-meter"
  | "guardrails"
  | "signing-primitive"
  | "credits"
  | "billing-orchestration"
  | "tool-exec"
  | "local-privacy"
  | "org-controls"
  | "retention-runner"
  | "local-store"
  | "local-sync"
  | "local-inference"
  | "agent-kernel"
  | "agent-runner"
  | "agent-trajectory"
  | "compliance-core"
  | "frameworks-pack"
  | "oscal-spine"
  | "access-review"
  | "risk-register"
  | "trust-page"
  | "alerting"
  | "ai-evals"
  | "prompt-registry";

/** The bespoke schematic set (the ADR-0377 blueprint language, completed by the ADR-0378
 *  migrate-all wave): a blueprint linework sheet per module, a cross-section strata sheet per
 *  bundle — each a CLAIM about shipped behaviour (copy law ADR-0080). The 24 shared mechanism
 *  diagrams this union once carried retired when every page gained its bespoke sheet
 *  (ADR-0377 migrate-all); their template died with them. */
export type DiagramKey =
  // The ADR-0377 pilot trio.
  | "schematic-field-crypto"
  | "schematic-audit-worm"
  | "schematic-compliance"
  // The ADR-0378 migrate-all wave plus the OSCAL carve: module sheets + 5 bundle cross-sections.
  | "schematic-ai-meter"
  | "schematic-guardrails"
  | "schematic-prompt-registry"
  | "schematic-ai-evals"
  | "schematic-signing-primitive"
  | "schematic-credits"
  | "schematic-billing-orchestration"
  | "schematic-alerting"
  | "schematic-tool-exec"
  | "schematic-local-privacy"
  | "schematic-org-controls"
  | "schematic-retention-runner"
  | "schematic-local-store"
  | "schematic-local-sync"
  | "schematic-local-inference"
  | "schematic-ui-pro"
  | "schematic-agent-kernel"
  | "schematic-agent-runner"
  | "schematic-agent-trajectory"
  | "schematic-compliance-core"
  | "schematic-frameworks-pack"
  | "schematic-oscal-spine"
  | "schematic-access-review"
  | "schematic-risk-register"
  | "schematic-trust-page"
  | "schematic-ai-production"
  | "schematic-local-first"
  | "schematic-agentic-dev"
  | "schematic-provenance"
  | "schematic-everything";

/** The live-rendered kit components wired into a media slide (ADR-0308 full-depth, extending
 *  ADR-0290). A catalog module earns a `component` slide only when it genuinely ships a showable
 *  `@caisson/ui`-rendered surface (the honest floor, ADR-0082 — every slide depicts SHIPPED
 *  behaviour, and the source is nameable):
 *    - `ui-pro` — the product IS a set of UI components (`@caisson/ui-pro`).
 *    - `audit-worm` · `ai-meter` · `prompt-registry` · `local-store` — each ships its OWN embeddable
 *      `@caisson/<mod>/ui` surface (ADR-0250 G2c/G2d): ChainViewer · UsageChart · PromptBrowser ·
 *      StoreSearch, presentational + headless-data-in.
 *    - `credits` — the real buyer-dashboard ledger surface (`@caisson/ui` LedgerList/MetricStat,
 *      apps/site/app/dashboard/credits): what the buyer sees when they hold credits.
 *  Every other catalog module is a backend/library package with no showable UI of its own and
 *  legitimately stays diagram(+code-artifact)-only. */
export type ComponentKey =
  | "ui-pro"
  | "audit-worm"
  | "ai-meter"
  | "prompt-registry"
  | "local-store"
  | "credits";

export interface MediaSlide {
  kind: SlideKind;
  /** One-line honest caption — the a11y label + the visible slide caption. */
  caption: string;
  /** kind === "diagram" — which authored mechanism diagram to render. */
  diagram?: DiagramKey;
  /** kind === "diagram" — a bundle composition slide (the modules→bundle→base pattern) instead of
   *  an authored SVG. Mutually exclusive with `diagram`. */
  compositionBundle?: BundleId;
  /** kind === "poke" — which interactive poke to render. */
  poke?: PokeKey;
  /** kind === "component" — which live kit component to render. */
  component?: ComponentKey;
  /** kind === "code-artifact" — the item's real depth-page artifact (module-pages.ts), resolved
   *  once here so the carousel never re-queries MODULE_PAGES itself. */
  artifact?: { label: string; file: string; code: string };
  /** kind === "image" — the brand mark rendered as placeholder art (decorative). */
  icon?: IconName;
}

const DIAGRAM_ORDER: readonly DiagramKey[] = [
  "schematic-field-crypto",
  "schematic-audit-worm",
  "schematic-compliance",
  "schematic-ai-meter",
  "schematic-guardrails",
  "schematic-prompt-registry",
  "schematic-ai-evals",
  "schematic-signing-primitive",
  "schematic-credits",
  "schematic-billing-orchestration",
  "schematic-alerting",
  "schematic-tool-exec",
  "schematic-local-privacy",
  "schematic-org-controls",
  "schematic-retention-runner",
  "schematic-local-store",
  "schematic-local-sync",
  "schematic-local-inference",
  "schematic-ui-pro",
  "schematic-agent-kernel",
  "schematic-agent-runner",
  "schematic-agent-trajectory",
  "schematic-compliance-core",
  "schematic-frameworks-pack",
  "schematic-oscal-spine",
  "schematic-access-review",
  "schematic-risk-register",
  "schematic-trust-page",
  "schematic-ai-production",
  "schematic-local-first",
  "schematic-agentic-dev",
  "schematic-provenance",
  "schematic-everything",
];

/** Exhaustiveness backstop (SHIP review P3-2): DIAGRAM_ORDER is a plain array TypeScript can't
 *  check against the union — a key missing here would silently never render. The keyed Records
 *  below ARE checked, so their key count is the truth; fail the module load on drift. */
function assertDiagramOrderExhaustive(
  targets: Record<DiagramKey, unknown>,
): void {
  const order = new Set(DIAGRAM_ORDER);
  const keys = Object.keys(targets);
  if (order.size !== DIAGRAM_ORDER.length || order.size !== keys.length) {
    throw new Error(
      `DIAGRAM_ORDER is out of sync with the DiagramKey set (${DIAGRAM_ORDER.length} ordered, ${keys.length} keyed)`,
    );
  }
}

const DIAGRAM_CAPTIONS: Record<DiagramKey, string> = {
  "schematic-field-crypto":
    "The package in blueprint: HKDF-SHA256 derives a distinct key per tenant, the AEAD gate binds tenant/key-version/column as authenticated data, and the self-describing envelope's byte layout means old key versions decrypt forever.",
  "schematic-audit-worm":
    "The package in blueprint: every append mints a length-keyed anchor into write-once S3 Object-Lock storage, and verify() treats that store as the trusted length oracle, so a cut tail fails even when the surviving prefix hashes clean.",
  "schematic-compliance":
    "The bundle in cross-section: commercial members at the module seam, composing onto the Apache-2.0 kernel and fail-closed RLS base, on Postgres and S3 Object-Lock bedrock; nine of the fourteen pinned members drawn.",
  "schematic-ai-meter":
    "The package in blueprint: reserve debits credits and checks the circuit breaker before the provider is ever called, and reconcile trues the charge to actual usage inside an atomic per-tenant spend window.",
  "schematic-guardrails":
    "The package in blueprint: a cheap regex pre-screen, the unconditional secret-shape gate, then the configured moderator under a deadline; an outage or timeout blocks the call, fail-closed.",
  "schematic-prompt-registry":
    "The package in blueprint: name@version or name@alias resolves to an immutable version, and renderPrompt validates untrusted variables against a strict schema before one escaped, non-recursive fill pass.",
  "schematic-ai-evals":
    "The package in blueprint: gateAgainstBaseline compares every run to a committed JSON baseline; a below-threshold run is rejected before the baseline is touched, and blessing is the only rewrite path.",
  "schematic-signing-primitive":
    "The package in blueprint: a per-tenant Ed25519 signer produces a detached signature over the canonicalized manifest and its chain-anchor tip hash, and verification fails closed on any error.",
  "schematic-credits":
    "The package in blueprint: grant() upserts the wallet atomically, and debit() walks unexpired grants in FIFO order, answering with a 402 the moment the remainder cannot be covered.",
  "schematic-billing-orchestration":
    "The package in blueprint: four provider drivers behind one BillingProvider port, where verifyAndParse feeds a claim-once idempotency guard that fulfills a redelivered webhook exactly once.",
  "schematic-alerting":
    "The package in blueprint: dedup, rate-cap, and quiet-hours short-circuit before multi-channel delivery, each channel isolated behind its own catch, and every outcome writes exactly one audit row.",
  "schematic-tool-exec":
    "The package in blueprint: a proposed command crosses the default-deny allowlist and Zod-strict argv validation before execFile runs it, never a shell.",
  "schematic-local-privacy":
    "The package in blueprint: every outbound payload crosses the egress guard's default-deny gate, and no host is reachable unless a typed policy allowlist names it.",
  "schematic-org-controls":
    "The package in blueprint: an owner-gated mutation crosses the admin-write RLS layer and lands two rows, the mutation and its audit entry; a seat is denied at the role guard.",
  "schematic-retention-runner":
    "The package in blueprint: runErasure fans one validated request out to every registered target with per-target error isolation, then writes exactly one reason-tagged audit row.",
  "schematic-local-store":
    "The package in blueprint: a vec0 vector leg and an FTS5 keyword leg fuse by Reciprocal Rank Fusion at the RRF_K constant, degrading to keyword-only with no vector, over one SQLite file per tenant.",
  "schematic-local-sync":
    "The package in blueprint: per-replica changesets reconcile through the hybrid-logical-clock comparator into one converged row set, and a persisted tombstone keeps a deleted row from resurrecting.",
  "schematic-local-inference":
    "The package in blueprint: model fetches cross a guarded egress chokepoint with a host allowlist and SHA-256 hash-pin verify, and the off-by-default rented backend records a meter entry per call.",
  "schematic-ui-pro":
    "The package in blueprint: presentation components cross one seam into pure library functions, the audit timeline onto verifyChain, the grid onto sortRows and toCsv, composing onto the Apache-2.0 base kit.",
  "schematic-agent-kernel":
    "The package in blueprint: the seven-act lifecycle state machine admits only legal transitions, a failed verify reopens plan, and every governance hook answers in the shared HookResult shape.",
  "schematic-agent-runner":
    "The package in blueprint: the child env is built from scratch off a fixed allowlist, and the run spawns into an isolated worktree streaming an auditable .jsonl transcript.",
  "schematic-agent-trajectory":
    "The package in blueprint: every step appends to the run's event log with sensitive bodies held as digests, and approvals move through a compare-and-swap park-and-approve cycle.",
  "schematic-compliance-core":
    "The package in blueprint: each collector answers pass, flagged, or unresolved, and generateEvidencePack throws a typed 422 before producing anything while a single control is unresolved.",
  "schematic-frameworks-pack":
    "The package in blueprint: every crosswalk row is a discriminated union on its claim, an implements claim requires a proof pointer, and a maps-to claim carries none, across three own-authored framework packs.",
  "schematic-oscal-spine":
    "The package in blueprint: structural evidence and framework inputs cross one deterministic adapter boundary into OSCAL v1.2.2 assessment, catalog, XML, and ISO 27001 SoA artifacts, checked against a hash-pinned NIST reference.",
  "schematic-access-review":
    "The package in blueprint: closeCampaign refuses to close before every reviewee has decided or the deadline passes, and an undecided reviewee lands unresolved on the closed record, never auto-approved.",
  "schematic-risk-register":
    "The package in blueprint: computeResidual is the only mint for the branded residual score, and an operator override lands as its own chained exception record, never a silent edit.",
  "schematic-trust-page":
    "The package in blueprint: flattenManifestFacts declares the universe of facts a page could show, and the allowlist filter runs before either output renders, so an absent field never reaches HTML or JSON.",
  "schematic-ai-production":
    "The AI-Production bundle in cross-section: six commercial members at the module seam, composing onto the kernel, tenancy-rls, and ai-config base, on a Postgres bedrock.",
  "schematic-local-first":
    "The Local-first bundle in cross-section: five members at the module seam, composing onto the kernel base, on an on-device SQLite bedrock.",
  "schematic-agentic-dev":
    "The Agentic-Dev bundle in cross-section: five commercial members at the module seam, composing onto the kernel and ai-config base, on Postgres and on-device SQLite bedrock.",
  "schematic-provenance":
    "The Provenance bundle in cross-section: three commercial members at the module seam, composing onto the kernel base, on Postgres and S3 Object-Lock bedrock.",
  "schematic-everything":
    "The Everything bundle in cross-section: five persona bundles plus three platform modules at the module seam, composing onto the Apache-2.0 base, on Postgres, S3 Object-Lock, and on-device SQLite bedrock.",
};

// Which entries carry which sheet (`kind:slug`). Post-migration (ADR-0378), every sheet is
// single-target: the page whose package it draws. A module's bespoke sheet REPLACED the shared
// mechanism diagram(s) that once targeted its page.
const DIAGRAM_TARGETS: Record<DiagramKey, ReadonlySet<string>> = {
  "schematic-field-crypto": new Set(["module:field-crypto"]),
  "schematic-audit-worm": new Set(["module:audit-worm"]),
  "schematic-compliance": new Set(["bundle:compliance"]),
  "schematic-ai-meter": new Set(["module:ai-meter"]),
  "schematic-guardrails": new Set(["module:guardrails"]),
  "schematic-prompt-registry": new Set(["module:prompt-registry"]),
  "schematic-ai-evals": new Set(["module:ai-evals"]),
  "schematic-signing-primitive": new Set(["module:signing-primitive"]),
  "schematic-credits": new Set(["module:credits"]),
  "schematic-billing-orchestration": new Set(["module:billing-orchestration"]),
  "schematic-alerting": new Set(["module:alerting"]),
  "schematic-tool-exec": new Set(["module:tool-exec"]),
  "schematic-local-privacy": new Set(["module:local-privacy"]),
  "schematic-org-controls": new Set(["module:org-controls"]),
  "schematic-retention-runner": new Set(["module:retention-runner"]),
  "schematic-local-store": new Set(["module:local-store"]),
  "schematic-local-sync": new Set(["module:local-sync"]),
  "schematic-local-inference": new Set(["module:local-inference"]),
  "schematic-ui-pro": new Set(["module:ui-pro"]),
  "schematic-agent-kernel": new Set(["module:agent-kernel"]),
  "schematic-agent-runner": new Set(["module:agent-runner"]),
  "schematic-agent-trajectory": new Set(["module:agent-trajectory"]),
  "schematic-compliance-core": new Set(["module:compliance-core"]),
  "schematic-frameworks-pack": new Set(["module:frameworks-pack"]),
  "schematic-oscal-spine": new Set(["module:oscal-spine"]),
  "schematic-access-review": new Set(["module:access-review"]),
  "schematic-risk-register": new Set(["module:risk-register"]),
  "schematic-trust-page": new Set(["module:trust-page"]),
  "schematic-ai-production": new Set(["bundle:ai-production"]),
  "schematic-local-first": new Set(["bundle:local-first"]),
  "schematic-agentic-dev": new Set(["bundle:agentic-dev"]),
  "schematic-provenance": new Set(["bundle:provenance"]),
  "schematic-everything": new Set(["bundle:everything"]),
};

assertDiagramOrderExhaustive(DIAGRAM_TARGETS);

/** Which modules carry a live-component slide, and the honest one-line caption for each (ADR-0308
 *  full-depth). The `component` is the live surface the carousel renders; the caption is the visible
 *  narration + a11y label. Keyed by module id — a module absent here has no showable UI surface and
 *  legitimately stays diagram(+code-artifact)-only. Preference order (ADR-0290): the component slide
 *  leads the module's carousel, ahead of any code-artifact or diagram. */
const MODULE_COMPONENTS: Readonly<
  Record<string, { component: ComponentKey; caption: string }>
> = {
  "ui-pro": {
    component: "ui-pro",
    caption:
      "The premium component layer on the open base, rendered live: the advanced data grid and the hash-chained audit timeline.",
  },
  "audit-worm": {
    component: "audit-worm",
    caption:
      "The module's own embeddable chain viewer, rendered live over a real kernel-built hash chain — the integrity verdict is computed, not asserted.",
  },
  "ai-meter": {
    component: "ai-meter",
    caption:
      "The module's own metered-usage surface, rendered live: per-model credit and cost rollups over usage events, integer units end to end.",
  },
  "prompt-registry": {
    component: "prompt-registry",
    caption:
      "The module's own registry browser, rendered live: one row per name@version with its role shape, variable count, and preview — append-only.",
  },
  "local-store": {
    component: "local-store",
    caption:
      "The module's own search surface, rendered live: a controlled query box over the tenant hybrid store with Reciprocal-Rank-Fusion-ranked hits.",
  },
  credits: {
    component: "credits",
    caption:
      "The buyer's dashboard credits surface, rendered live: the balance tile and the append-only ledger, every delta an integer credit unit.",
  },
};

/** Which modules carry an interactive poke slide (ADR-0378 lock 1 — the proof-triad floor).
 *  Captions are honest: they name what actually computes, never assert. */
const MODULE_POKES: Readonly<
  Record<string, { poke: PokeKey; caption: string }>
> = {
  "field-crypto": {
    poke: "field-crypto",
    caption:
      "Seal a value as one tenant and watch every other tenant fail to open it: real HKDF-SHA256 and AES-256-GCM running in your browser, the same derivation the package ships.",
  },
  "audit-worm": {
    poke: "audit-worm",
    caption:
      "Append entries, then edit history: the SHA-256 chain verdict flips at the broken link, and a cut tail fails against the anchor even when the surviving prefix hashes clean.",
  },
  "ai-meter": {
    poke: "ai-meter",
    caption:
      "Reserve before you spend, reconcile to actual usage, and trip the breaker: the package's own integer micro-USD math against the bundled price book.",
  },
  guardrails: {
    poke: "guardrails",
    caption:
      "Type something the boundary should stop: live PII detection with the package's real redaction modes, and a moderator outage that blocks fail-closed.",
  },
  "signing-primitive": {
    poke: "signing-primitive",
    caption:
      "Verify a per-tenant detached Ed25519 signature over a sample evidence manifest, then flip a payload byte or swap the key to watch it fail.",
  },
  credits: {
    poke: "credits",
    caption:
      "Grant four credit lines, debit them FIFO, then overdraw the wallet and read the real 402 InsufficientCreditsError.",
  },
  "billing-orchestration": {
    poke: "billing-orchestration",
    caption:
      "Redeliver the same provider webhook and watch the claim table fulfill it exactly once: the real billing-orchestration idempotency guard running in your browser.",
  },
  "tool-exec": {
    poke: "tool-exec",
    caption:
      "Type a command name and argv: the default-deny allowlist and Zod-strict schema decide before anything can spawn, right in your browser.",
  },
  "local-privacy": {
    poke: "local-privacy",
    caption:
      "Run the real fail-closed egress decision client-side against the two policies the module ships: the same host passes under one and blocks under the other.",
  },
  "org-controls": {
    poke: "org-controls",
    caption:
      "Switch the actor role from owner to seat and read the real assertCanManageMembers denial; the owner path shows the member row it would insert plus its audit-chain hash.",
  },
  "retention-runner": {
    poke: "retention-runner",
    caption:
      "Fan out one erasure across three targets with per-target error isolation, and watch exactly one reason-tagged audit row land every time, even when a target fails.",
  },
  "local-store": {
    poke: "local-store",
    caption:
      "An RRF explorer over a fixed 8-doc corpus: the vector leg and the FTS5 keyword leg rank independently, and the package's real RRF_K=60 fusion pulls a keyword-only match up the fused ranking.",
  },
  "local-sync": {
    poke: "local-sync",
    caption:
      "Two replicas edit offline and converge to one state through reconcileWithTombstones, with a toggle proving a persisted tombstone is the only thing stopping a deleted row from coming back.",
  },
  "local-inference": {
    poke: "local-inference",
    caption:
      "Run a real embedding on-device and watch the egress meter hold at zero, until you opt a rented backend in.",
  },
  "agent-kernel": {
    poke: "agent-kernel",
    caption:
      "Click any act to attempt a lifecycle transition and watch the real illegal-skip error, or reopen PLAN after a failed VERIFY: the package's actual transition table in your browser.",
  },
  "agent-runner": {
    poke: "agent-runner",
    caption:
      "The child env is built from scratch off a seven-key allowlist: toggle a secret-shaped key in the sample parent env and watch it never reach the child process.",
  },
  "agent-trajectory": {
    poke: "agent-trajectory",
    caption:
      "Replay the same eleven-kind event log twice, then tamper one field and watch the projection diverge or the schema reject it outright.",
  },
  "compliance-core": {
    poke: "compliance-core",
    caption:
      "Flip six real compliance-core evidence collectors to pass, then watch the generator refuse with the real EvidencePackBlockedError or produce the honest pack shape, all computed client-side.",
  },
  "frameworks-pack": {
    poke: "frameworks-pack",
    caption:
      "Pick a real crosswalk clause and watch the production toOscalCatalog turn the matching controls into an OSCAL v1.2.2 catalog, or come up empty when the clause is not mapped.",
  },
  "oscal-spine": {
    poke: "oscal-spine",
    caption:
      "Choose a shipped framework identity and generate its deterministic OSCAL v1.2.2 Assessment Plan, then break the injected clock and watch the exporter fail closed.",
  },
  "access-review": {
    poke: "access-review",
    caption:
      "Decide each reviewee in a sample campaign, then try closing it early and watch the real closeCampaign guard refuse the partial close.",
  },
  "risk-register": {
    poke: "risk-register",
    caption:
      "Move the likelihood and impact sliders and watch the residual come out of the real computeResidual math, then record an override and see it land as a separate, accountable exception row.",
  },
  "trust-page": {
    poke: "trust-page",
    caption:
      "A live allowlist gate: toggle sample evidence-pack facts and watch only the allowed ones reach the trust page's HTML and JSON, then try to force a fabricated field past the gate.",
  },
  alerting: {
    poke: "alerting",
    caption:
      "Push one alert through dedup, rate cap, quiet hours, and delivery, running the real alerting pipeline math live in your browser.",
  },
  "ai-evals": {
    poke: "ai-evals",
    caption:
      "Drag two scorer sliders and watch the real baseline comparator fail closed, then bless the run on purpose and watch the committed baseline move.",
  },
  "prompt-registry": {
    poke: "prompt-registry",
    caption:
      "Promote or roll back the prod alias across a four-version prompt lineage: every version row stays on file forever, only the pointer moves, and pointing at an unminted version fails closed.",
  },
};

/** ADR-0380 lock 6: these three completion-wave depth pages lead with their already-shipped live
 *  poke, then the already-shipped schematic. `omitCodeArtifact` is the existing depth-page signal;
 *  every other depth page preserves the ADR-0378 schematic-first order, and `leadWithPoke` keeps
 *  its existing card-viewer behavior. */
const DEPTH_POKE_FIRST_MODULES = {
  "access-review": true,
  "risk-register": true,
  "trust-page": true,
} as const satisfies Partial<Record<PokeKey, true>>;

/** Bundles borrow the hero member's poke VERBATIM (ADR-0378 lock 1 — borrow, never fork): the same
 *  component the module page renders, one manifest line per bundle. */
const BUNDLE_POKES: Readonly<
  Record<string, { poke: PokeKey; caption: string }>
> = {
  compliance: {
    poke: "field-crypto",
    caption:
      "The bundle's hero member under your cursor: field encryption sealed live and cross-tenant opens failing, exactly as the field-crypto module page proves it.",
  },
  "ai-production": {
    poke: "ai-meter",
    caption:
      "The bundle's hero member under your cursor: reserve, reconcile, and breaker-trip in the package's own integer math, exactly as the ai-meter module page proves it.",
  },
  provenance: {
    poke: "audit-worm",
    caption:
      "The bundle's hero member under your cursor: edit history and watch the chain verdict flip, exactly as the audit-worm module page proves it.",
  },
  "agentic-dev": {
    poke: "agent-kernel",
    caption:
      "The bundle's hero member under your cursor: the seven-act lifecycle stepper refusing illegal transitions, exactly as the agent-kernel module page proves it.",
  },
  "local-first": {
    poke: "local-store",
    caption:
      "The bundle's hero member under your cursor: hybrid retrieval fused by real RRF math, exactly as the local-store module page proves it.",
  },
};

/** The entry's mark, for the placeholder slide and the card glyph. */
function entryMark(kind: "bundle" | "module", id: string): IconName {
  if (kind === "bundle") {
    return isBundleId(id) ? BUNDLE_MARKS[id] : "bundle";
  }
  return moduleMark(id);
}

/** Honest one-liner for a bundle's composition slide — the real member count, never invented. */
function bundleCompositionCaption(id: BundleId): string {
  if (id === "everything") {
    return "The whole catalog — every bundle and every module — composing onto one Apache-2.0 audited base.";
  }
  const label = BUNDLES.find((b) => b.id === id)?.label ?? id;
  return `The ${label} bundle's real member modules, composing onto Caisson's Apache-2.0 audited base.`;
}

export interface MediaSlidesOptions {
  /** Skip the code-artifact slide (ADR-0290 WR-03) — the module depth page already renders
   *  `record.artifact` as a framed CodeBlock in its body, so its carousel would otherwise show
   *  the identical code twice. Card viewer / preview dialog omit this (code-artifact is the only
   *  place they show the code). */
  omitCodeArtifact?: boolean;
  /** Hoist the poke to slide 1 (ADR-0378 lock 1: the card viewer leads with the poke — the only
   *  slide kind that stops a scrolling buyer mid-gesture; depth pages lead with the sheet). */
  leadWithPoke?: boolean;
}

/** The ordered media slides for one entry (ADR-0378 lock 1, refining ADR-0290/0308). Module order:
 *  bespoke schematic sheet → poke → live component → code artifact (unless omitted). Bundle order:
 *  strata sheet → composition → the hero member's borrowed poke. `leadWithPoke` hoists the poke to
 *  slide 1 for the card viewer. If nothing applies, the brand placeholder is slide 1 so every
 *  entry has at least one slide. */
export function mediaSlides(
  kind: "bundle" | "module",
  id: string,
  options?: MediaSlidesOptions,
): readonly MediaSlide[] {
  const viewId = `${kind}:${id}`;
  const slides: MediaSlide[] = [];

  // Post-migration (ADR-0378), every targeted diagram IS a bespoke schematic sheet.
  const sheets = DIAGRAM_ORDER.filter((key) =>
    DIAGRAM_TARGETS[key].has(viewId),
  );
  const diagramSlide = (key: DiagramKey): MediaSlide => ({
    kind: "diagram",
    diagram: key,
    caption: DIAGRAM_CAPTIONS[key],
  });

  const pokeEntry = (kind === "module" ? MODULE_POKES : BUNDLE_POKES)[id];
  const pokeSlide: MediaSlide | null = pokeEntry
    ? { kind: "poke", poke: pokeEntry.poke, caption: pokeEntry.caption }
    : null;

  // The bespoke sheet leads (depth pages lead with the sheet — ADR-0378).
  for (const key of sheets) slides.push(diagramSlide(key));

  if (kind === "bundle" && isBundleId(id)) {
    slides.push({
      kind: "diagram",
      compositionBundle: id,
      caption: bundleCompositionCaption(id),
    });
  }

  if (pokeSlide) slides.push(pokeSlide);

  if (kind === "module") {
    const comp = MODULE_COMPONENTS[id];
    if (comp) {
      slides.push({
        kind: "component",
        component: comp.component,
        caption: comp.caption,
      });
    }
  }

  if (kind === "module" && !options?.omitCodeArtifact) {
    const record = MODULE_PAGES.find((r) => r.slug === id);
    if (record) {
      slides.push({
        kind: "code-artifact",
        artifact: {
          label: record.artifact.label,
          file: record.artifact.file,
          code: record.artifact.code,
        },
        caption: record.artifact.label,
      });
    }
  }

  const leadWithPoke =
    options?.leadWithPoke === true ||
    (options?.omitCodeArtifact === true &&
      Object.hasOwn(DEPTH_POKE_FIRST_MODULES, id));
  if (leadWithPoke && pokeSlide) {
    const at = slides.indexOf(pokeSlide);
    if (at > 0) {
      slides.splice(at, 1);
      slides.unshift(pokeSlide);
    }
  }

  if (slides.length === 0) {
    slides.push({
      kind: "image",
      caption: "",
      icon: entryMark(kind, id),
    });
  }
  return slides;
}

/** Whether an entry's viewer shows real media (not just the brand placeholder) — the media facet +
 *  card badge read this. True when any slide is something other than the fallback placeholder — a
 *  `code-artifact` slide (a real code snippet) counts as real media on the same footing as a diagram
 *  or a live component (ADR-0290). */
export function entryHasMedia(kind: "bundle" | "module", id: string): boolean {
  return mediaSlides(kind, id).some((s) => s.kind !== "image");
}
