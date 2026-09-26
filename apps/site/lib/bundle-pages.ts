// The module-family content record — the shared, typed SOT for the six module families' reusable
// page content, the sibling of `lib/module-pages.ts` for modules. Each of the five hand-authored
// module-family pages (`/compliance`, `/ai-kit`, `/local-first`, `/agentic-dev`, `/provenance`)
// reads its hero copy, member list, and FAQ from here so the same content powers both the
// standalone SEO page and the marketplace card viewer (`components/preview-dialog.tsx`). The
// `everything` entry has no standalone page (it lives on the marketplace surface); its entry
// exists only to power the viewer.
//
// SCOPE — what lives here vs. what stays in the page: this record holds the content the pop-out
// REUSES (hero, definition, members, faq) plus the page metadata, so a claim never drifts between
// the page and the pop-out. Each page's PAGE-UNIQUE bespoke prose — the "what it composes" and
// "who it's for" narratives, and the colored-token hero/terminal artifacts — stays inline in the
// page: it is not pop-out-reused, and shattering that bespoke JSX into a data record would trade
// byte-identical SEO output for zero reuse. Keep every claim true-to-built (ADR-0082) and V1-live
// (ADR-0237 rider 2).

import type { BundleId } from "./catalog";

// Spelled-out counts for composition headings (e.g. "Seven composed packages.") — small, fixed
// vocabulary matching the site's existing voice ("Fourteen packages, one module family.", "Five
// technical controls…"). Never hand-type a count word beside a `.map()`-rendered grid (ADR-0082
// F6): always derive it from the same array the grid renders, through this one spot.
const COUNT_WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
] as const;

/** Spell out a small count (falls back to the numeral past the named list — no product surface
 *  needs it, but a silent wraparound to "Zero" would be worse than a numeral). */
export function spellCount(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

/** One composed member of a module family — the id (a MODULES id or a base-package slug), its
 *  display name as the page renders it, and the reader-facing one-liner. Linked state is derived
 *  by the page (a member with a MODULES row links to its depth page). */
export interface BundlePageMember {
  id: string;
  name: string;
  oneLiner: string;
}

export interface BundlePageRecord {
  /** = BundleId — the module family's stable id and the card-viewer deep-link (`?view=bundle:<slug>`; the
   *  legacy `?b=<slug>` still resolves as an alias). */
  slug: BundleId;
  /** Short page-title (the `<title>` head, not the H1). */
  metaTitle: string;
  /** The meta description — reused verbatim as the SoftwareApplication JSON-LD description. */
  metaDescription: string;
  /** Hero eyebrow / title / lede — the page's `<Hero>` reads these; the credentials + artifact
   *  stay inline (page-unique, colored-token JSX). */
  hero: { eyebrow: string; title: string; lede: string };
  /** 40-70 word "what it is" for the pop-out (mirrors ModulePageRecord.definition). */
  definition: string;
  /** The module family's composed members, in the order the page renders them (includes base
   *  packages that have no standalone module page — those render unlinked). */
  members: readonly BundlePageMember[];
  /** Visible FAQ — also the source of the page's FAQPage JSON-LD. */
  faq: readonly { question: string; answer: string }[];
}

export const BUNDLE_PAGES: readonly BundlePageRecord[] = [
  {
    slug: "compliance",
    metaTitle: "Compliance",
    metaDescription:
      "Fail-closed Postgres RLS, S3 Object-Lock WORM, an append-only audit chain, per-tenant field encryption, alerting, and a retention runner, composed into one module family and shipped with a SOC 2 / HIPAA evidence-pack generator. Caisson ships the technical controls and generates the evidence; the certification is your auditor's.",
    hero: {
      eyebrow: "Compliance-grade infrastructure for regulated SaaS",
      title: "Audit-ready from the first commit.",
      lede: "Compliance delivers fourteen packages in one module family: tenant isolation that fails closed, evidence that can't be overwritten, and machine-readable OSCAL exports backed by a pinned NIST catalog. Own the source, wire it in before your first customer, and hand an auditor an artifact instead of a slide deck.",
    },
    definition:
      "Compliance delivers fourteen @caisson-sh/* packages in one module family: fail-closed tenant isolation, an append-only audit chain over S3 Object-Lock WORM, per-tenant field encryption, alerting, a retention runner, an access-review campaign engine, an AI risk register, a public trust page, and a dedicated OSCAL spine that maps evidence into machine-readable assessment, catalog, and ISO 27001 SoA artifacts. Own the source, and wire it in before your first customer shares a row.",
    members: [
      {
        id: "kernel",
        name: "Kernel",
        oneLiner:
          "Typed config/schema, the SHA-256 chain primitive, and append-only versioning that the rest of the module family builds on.",
      },
      {
        id: "tenancy-rls",
        name: "Tenancy RLS",
        oneLiner:
          "Fail-closed row-level security, every tenant table enables AND forces RLS, so a query with no tenant context returns nothing.",
      },
      {
        id: "field-crypto",
        name: "Field encryption",
        oneLiner:
          "Per-tenant field encryption via HKDF-SHA256 + AES-256-GCM; a leaked tenant key exposes one tenant, never the table.",
      },
      {
        id: "audit-worm",
        name: "Audit chain + WORM",
        oneLiner:
          "Append-only SHA-256 audit chain plus an S3 Object-Lock WORM adapter, evidence storage tampering breaks the chain and is provable.",
      },
      {
        id: "migrate",
        name: "Migrate",
        oneLiner:
          "The one migration assembler and runner: forward-only, idempotent, and fails closed on checksum drift.",
      },
      {
        id: "alerting",
        name: "Alert pipeline",
        oneLiner:
          "Deduped, rate-capped alert delivery with quiet hours and an audit trail, the SOC 2 CC7.2 alerting control.",
      },
      {
        id: "retention-runner",
        name: "Retention runner",
        oneLiner:
          "Policy-driven data retention on a schedule, expiry and legal-hold, enforced automatically, not by a recurring calendar reminder.",
      },
      {
        id: "compliance-core",
        name: "Compliance core",
        oneLiner:
          "The RLS-force evidence collector, isolation tests, and the SOC 2 / HIPAA evidence-pack generator that maps live controls to named clauses.",
      },
      {
        id: "frameworks-pack",
        name: "Frameworks pack",
        oneLiner:
          "SOC 2, HIPAA, and EU AI Act control mappings, the clause-to-control catalog the evidence packs render against.",
      },
      {
        id: "oscal-spine",
        name: "OSCAL spine",
        oneLiner:
          "Deterministic OSCAL v1.2.2 assessment, catalog, XML, and ISO 27001 SoA exports with a byte-pinned NIST SP 800-53 rev5 reference catalog.",
      },
      {
        id: "signing-primitive",
        name: "Signing primitive",
        oneLiner:
          "Detached Ed25519 + RFC-3161 signing over evidence bundles and audit roots, a signature a third party can verify without your keys.",
      },
      {
        id: "access-review",
        name: "Access reviews",
        oneLiner:
          "Audit-prep access campaigns: import a membership snapshot, record each reviewer's attested approve/revoke decision onto the audit chain, and close with every undecided reviewee flagged unresolved, never auto-approved.",
      },
      {
        id: "risk-register",
        name: "AI risk register",
        oneLiner:
          "Likelihood x impact risk scoring with a computed, never freeform, residual; an operator override is its own chained exception, and every entry crosswalks into your framework packs.",
      },
      {
        id: "trust-page",
        name: "Trust page",
        oneLiner:
          "A self-contained public trust page rendered from your evidence pack through allowlist-based redaction, a field absent from the allowlist never reaches the page, no exceptions.",
      },
    ],
    faq: [
      {
        question: "Does Caisson make us SOC 2 or HIPAA certified?",
        answer:
          "No. Caisson ships the technical controls those frameworks require and generates the evidence to prove them. Certification comes from an auditor assessing your whole program, the organizational controls and the audit itself remain yours.",
      },
      {
        question: "Which packages does the module family actually compose?",
        answer:
          "Ten direct workspace dependencies are wired at runtime and re-exported through the module family's own entry point: kernel, tenancy-rls, field-crypto, audit-worm, migrate, alerting, retention-runner, compliance-core, frameworks-pack, and signing-primitive. compliance-core and frameworks-pack both depend on and re-export oscal-spine, so the OSCAL package is a real shared dependency in that runtime graph. Access reviews, the AI risk register, and the trust-page generator are three further standalone modules in the same module family. Nothing on this page is a manifest claim without code behind it.",
      },
      {
        question: "Do I own the source?",
        answer:
          "Yes. The code is Apache-2.0, and framework-mapping updates ship as ordinary npm releases.",
      },
    ],
  },
  {
    slug: "ai-production",
    metaTitle: "AI Production Kit",
    metaDescription: `A metered infer()/embed() gateway on Vercel AI SDK v7: Postgres-atomic token metering with a per-tenant circuit breaker, typed input/output guardrails, and versioned prompts, composed behind one chokepoint. Own the source.`,
    hero: {
      eyebrow: "AI-Production module family",
      title: "One gateway between your code and the model.",
      lede: "infer() and embed() are the only door to a model in this kit: every call resolves a versioned prompt, reserves against a per-tenant spend cap, crosses a guardrail on the way in and out, and reconciles usage in the same Postgres transaction as the result. Vercel AI SDK v7 sits behind it; your route handler calls infer(lane, input) and never touches a provider SDK directly. That door fronts all seven modules below: versioned prompts, metering, guardrails, and AI config on the call path; field encryption, the eval harness, and the credit ledger securing the data, the model swaps, and the spend behind it.",
    },
    definition:
      "The AI-Production module family puts one metered gateway between your code and the model: infer() and embed() resolve a versioned prompt, reserve against a per-tenant spend cap, cross input and output guardrails, and reconcile usage in the same Postgres transaction as the result. Vercel AI SDK v7 behind one fail-closed chokepoint.",
    members: [
      {
        id: "prompt-registry",
        name: "Prompt registry",
        oneLiner:
          "Versioned prompts with rollout history: promote or roll back a prompt by moving an alias pointer, no redeploy required.",
      },
      {
        id: "ai-meter",
        name: "Token metering",
        oneLiner:
          "PG-atomic token metering with per-tenant spend caps and a circuit breaker: a runaway prompt loop trips the breaker before it runs your bill up.",
      },
      {
        id: "guardrails",
        name: "Guardrails",
        oneLiner:
          "Input and output guardrails wired once, at the model boundary, instead of copy-pasted into every call site.",
      },
      {
        id: "field-crypto",
        name: "Field encryption",
        oneLiner:
          "Per-tenant field encryption via HKDF-SHA256 + AES-256-GCM; a leaked tenant key exposes one tenant, never the table.",
      },
      {
        id: "ai-evals",
        name: "Eval harness",
        oneLiner:
          "Regression-grade evals that run in CI: a model swap that scores below the committed baseline fails the build, not a customer's session.",
      },
      {
        id: "credits",
        name: "Credits + metering",
        oneLiner:
          "PG-atomic credit ledger, grant, debit, and spend-cap credits with one integer denomination, fail-closed (402) on an empty balance.",
      },
      {
        id: "ai-config",
        name: "AI config",
        oneLiner:
          "Provider-agnostic config resolver plus a settings file: the lane-to-provider mapping infer() reads to pick a model. Base substrate, composed in with no separate install step.",
      },
    ],
    faq: [
      {
        question: "What does token metering actually prevent?",
        answer:
          "A runaway loop, a misconfigured agent, or a single burst of traffic can multiply your API invoice by 10x before you see it. Usage writes in the same Postgres transaction as the result (an atomic increment), so concurrent calls can never double-count or drop a charge. Crossing the cap opens the circuit breaker and returns HTTP 402 before the next model call fires.",
      },
      {
        question: "What happens when a tenant hits their spend cap?",
        answer:
          "The breaker opens. The next model call returns HTTP 402 with a structured error body, the same as any other payment-required response in your API. The window resets on the configured interval. No partial responses, no silent overages.",
      },
      {
        question: "Can I use my own provider key instead of the platform lane?",
        answer:
          "Yes. BYOK resolves a tenant's own encrypted provider key ahead of the shared lane, written through the same per-tenant field-crypto boundary the rest of the platform uses. A BYOK-backed call debits zero credits, since the tenant is paying the model provider directly.",
      },
    ],
  },
  {
    slug: "local-first",
    metaTitle: "Local-first AI",
    metaDescription: `Local-first AI composes on-device ONNX inference, a zero-egress privacy gate, offline sync, and hybrid sqlite-vec + FTS5 search into one Caisson module family (own the source).`,
    hero: {
      eyebrow: "Local-first AI · Own the source",
      title: "Your data stays on the device by default.",
      lede: "The compute seam runs inference on-device by default; the privacy gate makes a hosted call an explicit opt-in, not a default you discover in a network trace. Vector search and sync run against local files, nothing round-trips to a vendor unless you allow it in writing.",
    },
    definition:
      "Local-first AI composes on-device ONNX inference, a default-deny privacy egress gate, offline two-way sync, and hybrid sqlite-vec + FTS5 search into one module family. Inference runs on-device by default; a hosted call is an explicit opt-in, never a default you discover in a network trace. Own the source.",
    members: [
      {
        id: "local-store",
        name: "@caisson-sh/local-store",
        oneLiner:
          "Hybrid retrieval: sqlite-vec ANN plus FTS5, merged by Reciprocal-Rank-Fusion, with an FTS-only fallback if the vector leg fails.",
      },
      {
        id: "field-crypto",
        name: "@caisson-sh/field-crypto",
        oneLiner:
          "Per-tenant field encryption: HKDF key derivation plus AES-256-GCM, sealed at rest under a key a different tenant's file cannot open.",
      },
      {
        id: "local-inference",
        name: "@caisson-sh/local-inference",
        oneLiner:
          "The InferenceBackend seam over a MiniLM-class ONNX model via transformers.js, SHA-256 hash-verified before use, on-device by default.",
      },
      {
        id: "local-privacy",
        name: "@caisson-sh/local-privacy",
        oneLiner:
          "A default-deny egress boundary every payload crosses before it can leave the process, an empty allowlist means zero egress.",
      },
      {
        id: "local-sync",
        name: "@caisson-sh/local-sync",
        oneLiner:
          "Two-way offline sync: changesets, tombstones, a logical clock, and a reconcile pass with a convergence test.",
      },
      {
        id: "kernel",
        name: "@caisson-sh/kernel",
        oneLiner:
          "The governance kernel underneath every module family: typed config, the shared error model, and security primitives.",
      },
    ],
    faq: [
      {
        question: 'Does "own the source" rule out hosted inference?',
        answer:
          "No. The compute seam supports opt-in rented transports (OpenRouter, Azure OpenAI, and AWS Bedrock) behind the same InferenceBackend interface used on-device. They are off by default; the privacy policy's allowlist is the only way any of those hosts becomes reachable.",
      },
      {
        question: "What does the on-device model need to run?",
        answer:
          "The ONNX backend runs a MiniLM-class model via transformers.js. The @huggingface/transformers runtime is an optional peer you install yourself (it is not bundled in the package), and the model weights are first-run-fetched and SHA-256 hash-verified before use. Air-gapped deployments pre-seed the cache and run fully offline.",
      },
      {
        question:
          "Can I use just the vector store instead of the whole module family?",
        answer:
          "Yes. @caisson-sh/local-store also works standalone, as do on-device inference, the sync engine, and the privacy gate. The full Local-first AI module family composes all seven packages.",
      },
    ],
  },
  {
    slug: "agentic-dev",
    metaTitle: "Agentic-Dev",
    metaDescription:
      "A governed-agent kernel for TypeScript codebases: typed agent/skill/rule schema, a guarded 7-act lifecycle, a sandboxed agent runner with a from-scratch scrubbed env, local hybrid memory, and a default-deny tool-exec gate. Own the source.",
    hero: {
      eyebrow: "Agentic-Dev module family",
      title:
        "A governed agent lifecycle, plus a sandboxed runner to execute it.",
      lede: "Agents declare their model lane, their tools, and their blast radius up front. A lifecycle state machine refuses to advance a run that failed verify. And when it's time to actually spawn an agent, the runner builds its child environment from scratch, never a spread of your process env, so a credential you never intended to hand over cannot leak into the sandbox.",
    },
    definition:
      "The Agentic-Dev module family is a governed-agent kernel plus a sandboxed runner to execute it: a typed agent/skill/rule schema, a guarded 7-act lifecycle that reopens PLAN when VERIFY fails, local hybrid memory, and a default-deny tool-exec gate, with a child environment built from scratch so a credential can't leak into the sandbox.",
    members: [
      {
        id: "agent-kernel",
        name: "Agent kernel",
        oneLiner:
          "Typed agent/skill/rule schema plus the guarded 7-act lifecycle FSM and hooks dispatcher, one of the module family's composed pieces, alongside local memory and the tool-exec gate.",
      },
      {
        id: "agent-runner",
        name: "Agent runner",
        oneLiner:
          "Spawns a headless coding agent as a detached subprocess in an isolated worktree with a from-scratch scrubbed env, streaming an auditable transcript.",
      },
      {
        id: "agent-trajectory",
        name: "Agent trajectory",
        oneLiner:
          "The governed run record: an append-only, replayable event log of every step, tool proposal, approval, and spend, sensitive bodies by digest, paused runs encrypted at rest, deterministic replay.",
      },
      {
        id: "local-store",
        name: "Local hybrid memory",
        oneLiner:
          "Per-tenant vec0 + FTS5 recall with reciprocal-rank fusion and an FTS-only offline floor; no memory item is ever a secret.",
      },
      {
        id: "tool-exec",
        name: "Sandboxed tool-exec gate",
        oneLiner:
          "Default-deny allowlist over Zod-strict argv schemas and execFile arg-arrays, an agent never reaches a shell.",
      },
    ],
    faq: [
      {
        question: "What's actually running when an agent executes?",
        answer:
          "@caisson-sh/agent-runner spawns the agent CLI as a detached subprocess in an isolated worktree with a child environment built from scratch, never a spread of your process env, plus a fixed non-secret passthrough allowlist and only the target provider's key. Every run streams a durable .jsonl transcript and resolves to a structured report of tool calls, files touched, and the final result.",
      },
      {
        question: "Can I use just the kernel or just the runner?",
        answer:
          "Yes. Every member of the Agentic-Dev module family also composes on its own onto your existing Caisson base: the agent kernel, the agent runner, the trajectory log, local hybrid memory (also a member of the Local-first module family), and the tool-exec gate.",
      },
      {
        question: "Does the runner or the kernel ever hold a credential?",
        answer:
          "No. Construction of the three pieces the module family's factory composes (kernel, memory, tool-exec gate) holds no credential and makes no network or LLM call. The agent runner ships as its own package alongside the module family; its buildEngineEnv() step is the one place a secret could reach a spawned process, and a ship-blocking leak-guard test attacks it with a polluted parent env and asserts the exact child env key set.",
      },
    ],
  },
  {
    slug: "provenance",
    metaTitle: "Provenance",
    metaDescription:
      "Cryptographic provenance for regulated data: detached Ed25519 + RFC-3161 signing, an append-only SHA-256 WORM audit chain, and per-tenant field encryption, the three primitives that prove a record wasn't tampered with. Own the source.",
    hero: {
      eyebrow: "Cryptographic provenance",
      title: "Prove the record wasn't tampered with.",
      lede: "Provenance composes three primitives into one module family: detached signing that a third party verifies without your keys, an append-only audit chain where a single altered row breaks every link after it, and per-tenant field encryption sealed at rest. Own the source, and hand an auditor a signature instead of a promise.",
    },
    definition:
      "Provenance composes three cryptographic primitives into one module family: detached Ed25519 + RFC-3161 signing a third party can verify without your keys, an append-only SHA-256 audit chain where one altered row breaks every link after it, and per-tenant field encryption sealed at rest. The proof travels with the artifact.",
    // Provenance renders its members from `modulesByBundle("provenance")`; the ids/names below match
    // that catalog order and those labels exactly, and the one-liners are the page's customer copy.
    members: [
      {
        id: "field-crypto",
        name: "Field encryption",
        oneLiner:
          "Per-tenant field encryption via HKDF-SHA256 + AES-256-GCM, a leaked tenant key exposes one tenant, never the table.",
      },
      {
        id: "audit-worm",
        name: "Audit chain + WORM",
        oneLiner:
          "An append-only SHA-256 audit chain plus an S3 Object-Lock WORM adapter: tamper with a historical row and every link after it breaks, provably.",
      },
      {
        id: "signing-primitive",
        name: "Signing primitive",
        oneLiner:
          "Detached Ed25519 + RFC-3161 signing over an evidence bundle or an audit root, a signature a third party verifies without ever touching your keys.",
      },
    ],
    faq: [
      {
        question: "How is Provenance different from Compliance?",
        answer:
          "Provenance is the cryptographic core: signing, the WORM audit chain, and field encryption, the three primitives that prove a record is authentic and untampered. Compliance wraps those in the full regulated-SaaS stack: fail-closed RLS, the evidence-pack generator, the framework mappings, alerting, and retention. Every Provenance module is also in Compliance, so Compliance owners already have it.",
      },
      {
        question: "Which packages does the module family compose?",
        answer:
          "Three real workspace dependencies: @caisson-sh/signing-primitive (detached Ed25519 + RFC-3161), @caisson-sh/audit-worm (the SHA-256 audit chain plus the S3 Object-Lock adapter), and @caisson-sh/field-crypto (per-tenant HKDF-SHA256 + AES-256-GCM). Nothing on this page is a manifest claim without composed code behind it.",
      },
      {
        question: "Can a third party verify a signature without my keys?",
        answer:
          "Yes. Signatures are detached Ed25519 with an RFC-3161 timestamp: a verifier checks the artifact against your public key and the timestamp authority, with no access to the signing key. The audit-chain root and WORM retention are likewise independently checkable.",
      },
    ],
  },
  {
    slug: "everything",
    metaTitle: "Everything",
    metaDescription:
      "Everything: every Caisson module family and every module, composed on the same audited base.",
    hero: {
      eyebrow: "Everything",
      title: "The whole catalog, one composition.",
      lede: "Everything is exactly what it says: every module family and every module, the full catalog, composed on the same audited base.",
    },
    definition:
      "Everything is the whole catalog: every module family and every module, composed on the same audited base. Only the private brand layer is excluded.",
    // Everything is the whole catalog by construction; the pop-out renders a catalog
    // summary rather than a fixed member list, so this stays empty.
    members: [],
    faq: [],
  },
];

/** The module-family content record for a bundle id, or `undefined` for an unknown id. */
export function bundlePageRecord(slug: string): BundlePageRecord | undefined {
  return BUNDLE_PAGES.find((b) => b.slug === slug);
}

/** The record for a known bundle id — throws (a build-time bug) if one is missing, so a page never
 *  threads a `?`-guard for a record the BUNDLE_PAGES bijection guarantees. */
export function requireBundlePage(slug: BundleId): BundlePageRecord {
  const record = bundlePageRecord(slug);
  if (record === undefined) {
    throw new Error(
      `bundle-pages.ts: no content record for module family "${slug}"`,
    );
  }
  return record;
}
