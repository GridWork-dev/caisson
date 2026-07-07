// Glossary term data + the page-spec builder (glossary SPEC Task 3, ADR-0235). A term is a terse
// content record; `glossaryPageSpec` is the ONE caller of the generic `<PageSections>` renderer
// (page-sections.ts) that stamps the shared grammar — it does not push a fixed-slot template into
// the renderer, which stays a plain switch (renderer SPEC §3).
//
// `GLOSSARY_TERMS` is compile-time-static in-repo source (ADR-0002 carve-out, renderer SPEC §4) —
// no Zod parse layer; every term is type-checked at build, not validated at runtime.
import { createElement } from "react";

import type { PageSection, PageSpec } from "./page-sections";

export type GlossaryCluster =
  "compliance" | "security" | "licensing" | "ai-infra";

export interface GlossaryTermArtifact {
  label: string;
  lang: "ts" | "sql" | "toml" | "bash";
  code: string;
  clause?: string;
}

export interface GlossaryTermProperty {
  title: string;
  body: string;
}

export interface GlossaryTermFaqItem {
  question: string;
  answer: string;
}

export interface GlossaryTermSells {
  edition?: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface GlossaryTerm {
  /** "worm-audit-log" → /glossary/worm-audit-log */
  slug: string;
  /** "WORM audit log" → H1 + <title> + DefinedTerm.name */
  term: string;
  /** Hub grouping + related-term scoping. */
  cluster: GlossaryCluster;
  /** Answer-first, 40-60 words, keyword in the first clause (ADR-0079 §5, ADR-0080 §6). Renders
   *  as the lede AND feeds DefinedTerm.description. */
  definition: string;
  /** The real Caisson code that implements the term (ADR-0079 §2 mandate; true-to-built, ADR-0082). */
  artifact: GlossaryTermArtifact;
  /** 2-4 key properties (→ featureGrid) — how it works / why it holds. */
  properties: readonly GlossaryTermProperty[];
  /** 2-4 answer-first questions (→ faq), real questions only (ADR-0080 §6). */
  faq: readonly GlossaryTermFaqItem[];
  /** The product surface this term sells — intent-matched CTA (ADR-0080 §5). */
  sells: GlossaryTermSells;
  /** Curated cross-links (2-4 same-cluster slugs) — Fork D, no auto-linking. */
  related?: readonly string[];
}

// All 32 ADR-0235-locked terms: batch 1 (renderer + hub + the full 10-term compliance cluster +
// two pilots, Fork C) followed by batches 2-3 (security, licensing, ai-infra remainders; the two
// cross-cutting terms fold into compliance/ai-infra since the SPEC's binding cluster union has no
// fifth value). Copy is adversarially verified per Fork B — do not rewrite; a typo fix is fine,
// a claim change is not. `related` entries are curated same-cluster slugs (Fork D).
export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  {
    slug: "worm-audit-log",
    term: "WORM audit log",
    cluster: "compliance",
    definition:
      "A WORM audit log is an audit trail stored write once, read many: entries can be appended but never altered or deleted, not even by an administrator. Caisson's audit-worm package hash-chains each entry, then writes a write-once anchor for the chain to WORM storage on every append, so tamper, truncation, and rewrite each surface on verify.",
    artifact: {
      label:
        "AuditChainStore.append: mint the WORM anchor after every entry, write-once, fail-closed on collision",
      lang: "ts",
      code: 'const entries = await loadEntries(tx, accountId);\nconst anchor = anchorChain(entries);\n\n// The trusted commitment lands in WORM under a LENGTH-keyed, write-once key. A second anchor\n// for the same length (a truncate-then-re-append, a replay) hits the existing immutable object\n// → ArtifactExistsError → ConflictError: the original tip can never be overwritten (TM-H).\ntry {\n  await this.store.put(\n    anchorKey(accountId, anchor.length),\n    encodeAnchor(anchor),\n    {\n      retainUntil,\n      contentType: "application/json",\n    },\n  );\n} catch (err) {\n  if (err instanceof ArtifactExistsError) {\n    throw new ConflictError(\n      "audit chain anchor already exists for this length",\n      { accountId, length: anchor.length },\n    );\n  }\n  throw err;\n}\n\nreturn { entry, anchor };',
    },
    properties: [
      {
        title: "Two composable guarantees, one class",
        body: "AuditChainStore composes the kernel's pure hash-chain algebra with a write-once WORM object store: the DB grant can't be rewritten (no UPDATE/DELETE privilege) and the anchor object can't be overwritten either (a write-once key); no single control has to hold alone.",
      },
      {
        title: "Every append mints a fresh anchor, in the same call",
        body: "append() inserts the chain entry and, before returning, mints a length-keyed anchor over the resulting chain and writes it write-once to WORM storage; the anchor and the entry it commits to land together, never as a later batch job that could be skipped.",
      },
      {
        title: "Re-anchoring a length collides, it never overwrites",
        body: "A truncate-then-replay or a duplicate append for an already-anchored length hits the WORM store's existing immutable object and throws ConflictError: the original tip can never be silently replaced by a second write.",
      },
      {
        title: "Tenant-scoped and serialized against forks",
        body: "Every append runs inside withTenant behind a per-tenant advisory lock, so a forgotten tenant filter can't cross-write another tenant's chain and two concurrent appends can't mint two different tips for the same length.",
      },
    ],
    faq: [
      {
        question: "What does 'WORM' mean in an audit log?",
        answer:
          "Write Once, Read Many: an object can be created but never modified or deleted once written, enforced by the storage layer itself rather than application convention. Caisson pairs a WORM object store with a hash-chained log so both the log and its integrity commitment are independently tamper-evident.",
      },
      {
        question:
          "How is a WORM audit log different from a plain append-only log?",
        answer:
          "An append-only log stops updates and deletes at the database-privilege level; a WORM audit log adds a second, independent guarantee by anchoring the chain's commitment in storage that itself refuses overwrite. A full database compromise still can't rewrite history without also defeating the separate WORM store.",
      },
      {
        question: "Does a WORM audit log make us SOC 2 or HIPAA compliant?",
        answer:
          "No. It ships the technical control SOC 2 CC7.2 and HIPAA 164.312(b) check for (a tamper-evident, immutable record of activity) and generates the evidence an auditor examines; it does not itself constitute a compliance certification.",
      },
      {
        question: "What happens if an attacker gets full database access?",
        answer:
          "They can append new rows, but the DB grant withholds UPDATE/DELETE so existing entries can't be altered from that access alone. Even a rewrite at the storage layer would leave the chain's tip hash no longer matching the write-once anchor already committed to WORM storage, and verify() reports the break.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel:
        "See how the Compliance edition ships the WORM-anchored audit log",
      ctaHref: "/compliance",
    },
    related: [
      "append-only-audit-log",
      "hash-chain-audit-trail",
      "s3-object-lock",
      "worm-retention-policy",
    ],
  },
  {
    slug: "append-only-audit-log",
    term: "Append-only audit log",
    cluster: "compliance",
    definition:
      "An append-only audit log lets entries be inserted but never altered or deleted — enforced at the database-privilege level, not just app code. Caisson hash-chains each entry to its predecessor in the kernel, then the Compliance edition's audit-worm package anchors the chain's length and tip hash write-once to WORM storage, so tampering, reordering, or truncation each surface on verify.",
    artifact: {
      label:
        "verifyChain — recompute + compare each link, return the first broken index",
      lang: "ts",
      code: "export function verifyChain(\n  entries: readonly AuditChainEntry[],\n  anchor?: AuditChainAnchor,\n): ChainVerification {\n  for (let i = 0; i < entries.length; i++) {\n    const entry = entries[i] as AuditChainEntry;\n    const expectedPrev =\n      i === 0 ? null : (entries[i - 1] as AuditChainEntry).hash;\n    if (entry.seq !== i) return { valid: false, brokenAt: i };\n    if (entry.prevHash !== expectedPrev) return { valid: false, brokenAt: i };\n    if (entry.hash !== hashChainLink(entry.prevHash, entry.payload)) {\n      return { valid: false, brokenAt: i };\n    }\n  }",
    },
    properties: [
      {
        title: "Immutable by privilege, not convention",
        body: "The audit_chain_entry table's migration grants the app role SELECT + INSERT only — UPDATE and DELETE are never granted, and FORCE ROW LEVEL SECURITY holds even for the table owner. A compromised or buggy query can append a row; it cannot rewrite or drop one.",
      },
      {
        title: "Each entry hashes over its predecessor",
        body: "Every entry's hash is SHA-256 over a canonicalized [prevHash, payload] tuple, with payload keys deterministically sorted so the hash is reproducible across machines. Edit, reorder, or drop a middle entry and every hash after that point breaks; verifyChain returns the first broken index.",
      },
      {
        title: "A WORM anchor catches what the chain alone can't",
        body: "Internal consistency doesn't prove completeness — a truncated tail or a wholesale-rewritten chain can still verify clean on its own. Every append mints a {length, tipHash, genesisHash} commitment and writes it write-once to WORM object storage, so a length or tip mismatch on read-back proves truncation or rewrite.",
      },
      {
        title: "No forked chains under concurrent writes",
        body: "Appends for one tenant serialize under pg_advisory_xact_lock, and UNIQUE(account_id, seq) is the hard belt underneath it: two racing appends that read the same tip collide on 23505 and the loser gets a ConflictError to retry against the new tip.",
      },
    ],
    faq: [
      {
        question: "How do you build an append-only audit log in Postgres?",
        answer:
          "Withhold the privilege, not just the intent: grant the app role SELECT and INSERT on the audit table and never grant UPDATE or DELETE, with FORCE ROW LEVEL SECURITY so even the table owner is tenant-scoped. Caisson pairs that with a SHA-256 hash chain over each row so any edit that somehow lands is still detectable.",
      },
      {
        question:
          'What actually makes an audit trail immutable, versus just "we don\'t UPDATE it"?',
        answer:
          "Three independent mechanisms: the DB grant withholds UPDATE/DELETE entirely, the hash chain makes any interior tamper recompute-detectable, and a WORM-stored anchor (length + tip hash) catches tail truncation or a full rewrite — the one failure mode a self-consistent chain can't see on its own.",
      },
      {
        question:
          "Can someone truncate the tail of the log and have it still look valid?",
        answer:
          "A truncated chain is still internally self-consistent — every remaining hash still recomputes — so no, an append-only log without an external anchor can't catch that on its own. Caisson closes the gap with a trusted {length, tipHash} commitment written to WORM storage after every append; verify checks the DB's current length against it.",
      },
      {
        question:
          "Does an append-only audit log make us SOC 2 or HIPAA compliant?",
        answer:
          "No — it ships the technical control (tamper-evident, privilege-enforced logging) and generates the evidence an auditor asks for; it does not itself constitute compliance. SOC 2 CC7.2 and HIPAA 164.312(b) both expect this class of control, and this is what satisfies the control, not the certification.",
      },
    ],
    sells: {
      ctaLabel:
        "See how the Compliance edition ships the WORM-anchored audit chain",
      ctaHref: "/compliance",
      edition: "Compliance",
    },
    related: [
      "hash-chain-audit-trail",
      "audit-evidence-bundle",
      "s3-object-lock",
    ],
  },
  {
    slug: "hash-chain-audit-trail",
    term: "Tamper-evident hash chain",
    cluster: "compliance",
    definition:
      "A tamper-evident hash chain is an append-only audit sequence where each entry's hash commits to the prior entry's hash plus its own payload, so editing, reordering, or deleting any interior entry breaks every hash computed after it. Verification recomputes the chain end to end and reports the first index where it breaks.",
    artifact: {
      label:
        "hashChainLink() — the chain-link hash: SHA-256 over [prevHash, payload]",
      lang: "ts",
      code: 'export function hashChainLink(\n  prevHash: string | null,\n  payload: JsonValue,\n): string {\n  return createHash("sha256")\n    .update(canonicalize([prevHash, payload]))\n    .digest("hex");\n}',
    },
    properties: [
      {
        title: "Truncation and rewrite need an anchor",
        body: "Internal consistency alone doesn't prove completeness: a chain with its last N entries dropped, or a wholly forged replacement chain, still verifies clean. anchorChain mints a committed { length, tipHash, genesisHash } triple held outside the chain in WORM storage; passing it to verifyChain catches both.",
      },
      {
        title: "Deterministic canonicalization",
        body: "canonicalize() recursively sorts object keys before hashing, so two payloads that differ only in key order produce the identical hash. The chain is reproducible across machines, languages, and JSON serializers — the hash input, not just the algorithm, is load-bearing.",
      },
      {
        title: "Pinpoints the first break",
        body: "verifyChain walks every entry's seq, prevHash linkage, and recomputed hash in order and returns the index of the first failure, not just a pass/fail bit, so an interior edit, insert, reorder, or drop is located precisely.",
      },
    ],
    faq: [
      {
        question: "What does the hash chain actually detect?",
        answer:
          "Any edit, insertion, reordering, or drop of an interior entry. Each entry's hash commits to the previous entry's hash plus its own payload, so tampering with entry N breaks every hash from N onward, and verification reports the first broken index.",
      },
      {
        question:
          "Can someone truncate the end of the chain or replace it wholesale without detection?",
        answer:
          "Not against an anchored chain. verifyChain alone only proves the supplied entries are mutually consistent, but pairing it with the anchor committed by anchorChain (length + tip hash held in WORM storage) catches both a dropped tail and a forged replacement.",
      },
      {
        question: "Is verifying the chain a secret comparison?",
        answer:
          "No. Chain hashes are public integrity tags, not secrets, so verifyChain uses plain equality; crypto.timingSafeEqual is reserved for tokens, keys, and HMACs.",
      },
    ],
    sells: {
      ctaLabel: "Add to cart",
      ctaHref: "/compliance",
    },
    related: ["append-only-audit-log"],
  },
  {
    slug: "s3-object-lock",
    term: "S3 Object Lock",
    cluster: "compliance",
    definition:
      "S3 Object Lock is AWS S3's built-in WORM control: GOVERNANCE mode blocks delete/overwrite except for a privileged bypass caller; COMPLIANCE mode blocks it for everyone, including AWS account root, until a retain-until date. Caisson's audit-worm store writes every artifact with a conditional write-once PUT and a matching ObjectLockMode + retain-until date, so the S3 lock provably matches the database row.",
    artifact: {
      label:
        "S3ArtifactStore.put — conditional write-once PUT + Object-Lock retention date",
      lang: "ts",
      code: 'assertSafeKey(key);\nconst command = new PutObjectCommand({\n  Bucket: this.bucket,\n  Key: key,\n  Body: body,\n  ContentLength: body.byteLength,\n  // Write-once: S3 fails a conditional PUT to an existing key with 412 (TM-H).\n  IfNoneMatch: "*",\n  // Retention lock: object date == DB `retain_until` (ADR-0051/0054).\n  ObjectLockMode: this.mode,\n  ObjectLockRetainUntilDate: opts.retainUntil,\n});\ntry {\n  await this.client.send(command);\n} catch (err) {\n  // 412 Precondition Failed == the key already holds an immutable object (WORM violation).\n  if (httpStatusOf(err) === 412) throw new ArtifactExistsError(key);\n  throw err;\n}',
    },
    properties: [
      {
        title: "Write-once PUT enforces WORM before any lock check",
        body: 'Every put() is a conditional PutObjectCommand with IfNoneMatch: "*" — S3 answers 412 on an existing key, which the store maps to ArtifactExistsError. No overwrite code path exists independent of the lock itself.',
      },
      {
        title: "COMPLIANCE mode sits behind a three-belt fail-closed gate",
        body: 'assertComplianceAllowed refuses COMPLIANCE under a test runner, refuses it outside NODE_ENV === "production", and refuses it without a typed IrreversibleComplianceOptIn naming the exact bucket — all three checked at construction, before any S3 call.',
      },
      {
        title: "Retention only ever extends or escalates, never shortens",
        body: "extendRetention rejects any date not strictly later than the current lock; escalateToCompliance rejects any date earlier than the current lock. Both read the authoritative lock via GetObjectRetention first — HeadObject silently omits lock fields without s3:GetObjectRetention, which would fail open.",
      },
      {
        title: "The S3 lock date is the database row's date",
        body: "ObjectLockRetainUntilDate is set to the caller's opts.retainUntil on every write, and metaFrom projects it straight back out on get/head — so the retain-until an auditor reads off the S3 object is the same value stored in the DB row, not a derived approximation.",
      },
    ],
    faq: [
      {
        question:
          "What's the difference between GOVERNANCE and COMPLIANCE Object Lock mode?",
        answer:
          "GOVERNANCE is bypassable by an IAM caller holding s3:BypassGovernanceRetention; COMPLIANCE is not — not even the AWS account root can shorten or delete it before the retain-until date. Caisson's audit-worm store picks one mode per bucket (one evidence class) and gates COMPLIANCE behind a typed, explicit opt-in that's refused outside a production deployment.",
      },
      {
        question: "Does S3 Object Lock alone make us SOC 2 or HIPAA compliant?",
        answer:
          "No — Object Lock ships the technical retention control that SOC 2 CC7.x system-operations criteria and HIPAA 164.312(c) integrity requirements check for, and generates the evidence that it's in force. Compliance status is an audit conclusion your assessor reaches; the control is one input to that, not a certification.",
      },
      {
        question: "Can a retention lock be shortened or deleted once it's set?",
        answer:
          "No path in audit-worm shortens a lock or removes COMPLIANCE mode. extendRetention only accepts a strictly-later date and escalateToCompliance only moves GOVERNANCE→COMPLIANCE at an equal-or-later date — both read the current lock via GetObjectRetention first, then refuse anything earlier with a ValidationError before any S3 write (PutObjectRetention) runs.",
      },
      {
        question:
          "Does Object Lock require anything on the S3 bucket beyond writing the API calls?",
        answer:
          "Yes — Object Lock must be enabled on the bucket itself (at creation, with versioning) before any PutObjectRetention call takes effect. Caisson's store assumes an Object-Lock-enabled bucket and fails closed on the application side (write-once PUT, typed COMPLIANCE opt-in) rather than depending on bucket config alone.",
      },
    ],
    sells: {
      ctaLabel:
        "See how the Compliance edition ships live WORM on S3 Object Lock",
      ctaHref: "/compliance",
      edition: "Compliance",
    },
    related: [
      "worm-retention-policy",
      "append-only-audit-log",
      "hash-chain-audit-trail",
    ],
  },
  {
    slug: "oscal",
    term: "OSCAL",
    cluster: "compliance",
    definition:
      "OSCAL is NIST's machine-readable format (XML or JSON) for security control catalogs, System Security Plans, and Assessment Results — the interchange layer FedRAMP and GRC tools expect. Caisson's Compliance edition maps each signed evidence pack into OSCAL v1.2.2 Security Assessment Results and Plan-of-Action-and-Milestones documents, bundled alongside a per-framework Assessment Plan and a SHA-256 integrity binding.",
    artifact: {
      label:
        "toOscalAssessmentResults — readiness maps to satisfied/not-satisfied, gap reason recorded not guessed",
      lang: "ts",
      code: 'const target: OscalFindingTarget =\n  control.readiness === "ready"\n    ? {\n        type: "objective-id",\n        "target-id": control.controlId,\n        status: { state: "satisfied" },\n      }\n    : {\n        type: "objective-id",\n        "target-id": control.controlId,\n        status: { state: "not-satisfied", remarks: gapReason(control) },\n      };\nfindings.push({\n  uuid: newId(),\n  title: `${control.controlId} — ${control.title}`,\n  description: control.statement,\n  target,\n  "related-observations": related,\n});',
    },
    properties: [
      {
        title: "Two documents, one mapping",
        body: 'The Security Assessment Results (SAR) gets one finding per control plus one observation per evidence item; the Plan of Action & Milestones (POA&M) gets one poam-item per gap control, referencing only the flagged evidence — a clean pack ships zero GAP poam-items, only a single truthful "no open remediation items" entry, which NIST\'s OSCAL schema requires (poam-items is min-1).',
      },
      {
        title: "Deterministic, not generative",
        body: "The wall-clock `now` and the UUID source `newId` are both injected seams — `newId` defaults to `crypto.randomUUID`, so raw output is non-deterministic unless a seam is pinned. With the UUID seam pinned, the same evidence pack canonicalizes to byte-identical OSCAL output — the same discipline the signed evidence pack and the WORM audit chain already run on.",
      },
      {
        title: "Flag-never-guess carries over",
        body: "A not-satisfied finding's `remarks` is the flagged evidence's recorded reason (gapReason()), never an inferred explanation — the canonical manifest it maps from has no unresolved evidence by construction.",
      },
      {
        title: "Bundled and hash-bound, not linked to a dead URL",
        body: "ADR-0231 authors a real per-framework Assessment-Plan and ships it inside the same signed bundle as the SAR and POA&M, referenced by a relative rlink with a SHA-256 hashes[] binding — replacing an earlier caisson.sh link that was never actually served.",
      },
    ],
    faq: [
      {
        question: "What is OSCAL?",
        answer:
          "OSCAL (the Open Security Controls Assessment Language) is NIST's JSON/XML schema for control catalogs, security plans, and assessment results — built so a GRC tool or a FedRAMP reviewer can ingest evidence directly instead of a human re-keying a PDF.",
      },
      {
        question: "Does Caisson generate an OSCAL Assessment Plan?",
        answer:
          "Yes — each framework ships a real OSCAL v1.2.2 assessment-plan document, bundled alongside the Security Assessment Results and referenced by a relative, SHA-256-hashed rlink (ADR-0231), not a placeholder.",
      },
      {
        question: "Does an OSCAL export mean we're SOC 2 or HIPAA compliant?",
        answer:
          "No. The OSCAL bundle is the evidence assessment and gap register — satisfied/not-satisfied per control, POA&M items for any gap — not a compliance certification; it ships the technical readiness picture the framework's own controls require, not a compliance guarantee.",
      },
      {
        question:
          "What OSCAL version does Caisson target, and does it emit XML too?",
        answer:
          "v1.2.2, locked by ADR-0179 as the single oscal-cli validate conformance target. JSON is the canonical, byte-stable output; an XML sibling is produced by shelling out to NIST's own oscal-cli converter (never a hand-rolled serializer).",
      },
    ],
    sells: {
      ctaLabel: "See how the Compliance edition ships OSCAL evidence bundles",
      ctaHref: "/compliance",
    },
    related: [
      "control-to-code-mapping",
      "audit-evidence-bundle",
      "hipaa-technical-safeguards",
      "soc2-audit-log",
    ],
  },
  {
    slug: "control-to-code-mapping",
    term: "Control-to-code mapping",
    cluster: "compliance",
    definition:
      "Control-to-code mapping links a compliance requirement (a SOC 2 Trust Services Criterion, a HIPAA technical safeguard) to the specific code that implements it and the evidence proving that code runs. Caisson's Compliance edition ships this as a canonical control registry crosswalked to CC6.x / 164.312 citations, with key controls wired to live evidence collectors.",
    artifact: {
      label:
        "soc2Tsc control — one canonical control crosswalked to both SOC 2 CC6.1 and HIPAA 164.312(d)",
      lang: "ts",
      code: '{\n  id: "ACCESS-CONTROL.MFA",\n  title: "Multi-factor authentication for privileged access",\n  family: "Access Control",\n  statement:\n    "Privileged access to production systems and the tenant data plane requires a second " +\n    "authentication factor beyond a password; single-factor privileged sessions are denied.",\n  crosswalk: [\n    { framework: "SOC2-TSC", reference: "CC6.1" },\n    {\n      framework: "HIPAA-Security",\n      reference: "164.312(d)",\n      note: "Person-or-entity authentication strengthened by a second factor.",\n    },\n  ],\n},',
    },
    properties: [
      {
        title: "Clean-room control, crosswalked not copied",
        body: "CanonicalControl (registry/control.ts) is own-authored Caisson prose with a `crosswalk` array of `{framework, reference}` pointers — bare requirement IDs like `CC6.1` or `164.312(d)`, never the licensed AICPA/SCF criteria text. Crosswalk entries are validated unique on (framework, reference) at author time.",
      },
      {
        title: "Evidence collectors pin to a controlId",
        body: "Each EvidenceCollector declares the controlId it evidences (e.g. fieldCryptoPolicyCollector defaults to DATA-PROTECTION.PHI-ENCRYPTION) and turns a live at-rest sample into a pass/flagged/unresolved verdict — fail-closed: zero PHI fields inspected returns unresolved, never a guessed pass.",
      },
      {
        title: "Greppable code-to-ADR trail",
        body: 'Control-bearing code carries a one-line `Control: ADR-NNNN — <policy name>` docstring (the soc2Tsc pack cites ADR-0057), so `grep -rn "Control: ADR-" packages/*/src` is the auditor\'s control-to-code index with no separate spreadsheet to drift.',
      },
      {
        title: "Goldens pin the policy revision",
        body: "Golden fixtures capturing control-logic output carry a `policyVersion` field naming the ADR/catalog version the fixture was blessed under, so a drifted golden shows which policy revision the last-blessed evidence belongs to — the code-to-evidence leg of the trail.",
      },
    ],
    faq: [
      {
        question: "What is SOC 2 control mapping?",
        answer:
          "It is the traceability chain an auditor asks for: policy control → the code that implements it → evidence the implementation matches the policy. Caisson's canonical control registry is clean-room authored per framework and crosswalked to the AICPA Common Criteria / HIPAA identifiers as bare reference pointers, never copied criteria text.",
      },
      {
        question: "How do I map controls to code?",
        answer:
          'Two conventions, not a framework (docs/compliance/control-traceability.md): control-bearing code carries a `Control: ADR-NNNN` docstring line, making `grep -rn "Control: ADR-" packages/*/src` the control-to-code index, and golden fixtures that capture control-logic output pin a `policyVersion` so drift shows which policy revision the evidence belongs to.',
      },
      {
        question:
          "Does Caisson's control map make us SOC 2 or HIPAA compliant?",
        answer:
          "No. Caisson ships the technical controls CC6.x / 164.312 require and generates the evidence a collector observes at runtime; compliance status is your auditor's assessment across people, process, and technology, not a software claim any vendor can issue for you.",
      },
      {
        question: "Can one control satisfy both SOC 2 and HIPAA?",
        answer:
          "Yes — a canonical control's crosswalk array can carry references to multiple frameworks. ACCESS-CONTROL.MFA, for example, crosswalks to SOC 2 CC6.1 and HIPAA 164.312(d) from the same own-authored requirement, so one implementation evidences two frameworks at once.",
      },
    ],
    sells: {
      ctaLabel: "See the Compliance edition's control map",
      ctaHref: "/compliance",
    },
    related: [
      "soc2-audit-log",
      "hipaa-technical-safeguards",
      "oscal",
      "audit-evidence-bundle",
    ],
  },
  {
    slug: "audit-evidence-bundle",
    term: "Audit evidence bundle",
    cluster: "compliance",
    definition:
      "An audit evidence bundle is a generated package that ties each compliance control to the artifact proving it holds — logs, config, chain anchors — cited against the exact clause it satisfies. Caisson's version is a signed, deterministic ZIP: byte-stable manifest, fail-closed on any missing evidence, readiness derived from the evidence itself, never asserted.",
    artifact: {
      label:
        "generateEvidencePack - flag-never-guess: refuse the whole pack on any unresolved evidence",
      lang: "ts",
      code: '// PHASE 1 — flag-never-guess. Scan EVERY control for unresolved evidence before assembling\n// anything; refuse the whole pack if any is found. No filesystem touch here → no partial pack.\nconst unresolved: Array<{\n  controlId: string;\n  collectorId: string;\n  reason: string | undefined;\n}> = [];\nfor (const control of input.controls) {\n  for (const result of control.evidence) {\n    if (result.status === "unresolved") {\n      unresolved.push({\n        controlId: control.controlId,\n        collectorId: result.item.collectorId,\n        reason: result.reason,\n      });\n    }\n  }\n}\nif (unresolved.length > 0) {\n  const sortedUnresolved = [...unresolved].sort(\n    (a, b) =>\n      cmp(a.controlId, b.controlId) || cmp(a.collectorId, b.collectorId),\n  );\n  const report = parseEvidencePackBlocked({\n    formatVersion: EVIDENCE_PACK_FORMAT_VERSION,\n    tenantId: input.tenantId,\n    framework: input.framework,\n    blocked: true,\n    unresolved: sortedUnresolved,\n  });\n  throw new EvidencePackBlockedError(report);\n}',
    },
    properties: [
      {
        title: "Fail-closed, not fail-open",
        body: "generateEvidencePack() scans every control for an unresolved collector result before assembling anything. If even one exists, it throws EvidencePackBlockedError with a structured report of exactly what's missing — no partial or best-effort pack is ever produced.",
      },
      {
        title: "Readiness is derived, never asserted",
        body: 'A control\'s readiness ("ready"/"gap") is computed from its evidence items — gap iff any item is flagged — both when the generator builds it and again when pack-format\'s Zod schema re-validates it. The caller cannot inject a readiness value that disagrees with the evidence.',
      },
      {
        title: "Byte-stable and signable",
        body: "The wall clock is injected only onto the outer envelope (generatedAt) and never enters the canonical body. Controls are id-sorted, evidence is collector-id-sorted, and the ZIP writer uses fixed 1980-epoch mtimes and a fixed deflate level — so identical evidence always canonicalizes and archives to the identical SHA-256, independent of who ran it or when.",
      },
      {
        title: "Bound to the audit chain, not a standalone claim",
        body: 'Every pack pins a chainAnchor {length, tipHash} from the WORM audit chain, and its posture copy is regex-checked to reject the words "compliant"/"certified" — the bundle states control-evidence readiness only, never an audit opinion.',
      },
    ],
    faq: [
      {
        question: "What's in a Caisson audit evidence bundle?",
        answer:
          "A signed ZIP: a canonical manifest.json (controls, crosswalk citations, evidence, derived readiness), one JSON file per control under controls/, and a plain-text auditor-summary.txt — plus the WORM chain anchor the pack is bound to.",
      },
      {
        question:
          "Does generating an evidence bundle mean we're SOC 2 or HIPAA compliant?",
        answer:
          'No. The bundle ships the technical controls and evidence a framework\'s clauses require and states control-evidence readiness only — it is explicitly not an attestation or audit opinion, and the schema itself rejects any "compliant"/"certified" language in the output.',
      },
      {
        question: "What happens if evidence for a control is missing?",
        answer:
          "The generator refuses the entire bundle rather than shipping a partial one — flag-never-guess. It throws a structured BLOCKED report naming every control and collector still unresolved, so nothing gets handed to an auditor with a silent gap.",
      },
      {
        question:
          "Can the same evidence produce a different bundle each time it's generated?",
        answer:
          "No. Controls and evidence are sorted deterministically and the ZIP is built with fixed timestamps and compression settings, so identical underlying evidence always hashes to the same SHA-256 — a property an auditor can independently re-verify.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel: "See how the Compliance edition ships evidence bundles",
      ctaHref: "/compliance",
    },
    related: ["hash-chain-audit-trail", "oscal", "control-to-code-mapping"],
  },
  {
    slug: "worm-retention-policy",
    term: "WORM retention policy",
    cluster: "compliance",
    definition:
      "A WORM retention policy is the rule set fixing how long a stored object stays immutable and under which S3 Object-Lock mode: GOVERNANCE (operator-overridable) or COMPLIANCE (locked to the root, no exceptions). Caisson's `@caisson/audit-worm` computes a 6-year-floor retain-until date and only ever lets that date move later, never earlier.",
    artifact: {
      label:
        "extendRetention: strictly-later date, mode preserved; escalateToCompliance: GOVERNANCE→COMPLIANCE, same date allowed, never earlier",
      lang: "ts",
      code: '  async extendRetention(\n    key: string,\n    newRetainUntil: Date,\n  ): Promise<ArtifactMeta> {\n    assertSafeKey(key);\n    assertValidRetainUntil(newRetainUntil);\n    const current = await this.currentRetainUntil(key);\n    if (\n      current !== undefined &&\n      newRetainUntil.getTime() <= current.getTime()\n    ) {\n      throw new ValidationError(\n        "audit-worm: retention can only be EXTENDED — the new date must be strictly later than the current lock (ADR-0202)",\n        {\n          key,\n          currentRetainUntil: current.toISOString(),\n          requested: newRetainUntil.toISOString(),\n        },\n      );\n    }\n    await this.putRetention(key, this.mode, newRetainUntil);\n    const meta = await this.headOrThrow(key);\n    return { ...meta, retainUntil: newRetainUntil };\n  }\n\n  async escalateToCompliance(\n    key: string,\n    retainUntil: Date,\n    optIn: IrreversibleComplianceOptIn,\n  ): Promise<ArtifactMeta> {\n    assertSafeKey(key);\n    assertValidRetainUntil(retainUntil);\n    this.assertComplianceAllowed(optIn);\n    const current = await this.currentRetainUntil(key);\n    if (current !== undefined && retainUntil.getTime() < current.getTime()) {\n      throw new ValidationError(\n        "audit-worm: COMPLIANCE escalation cannot shorten retention — the date must be at or later than the current lock (ADR-0202)",\n        {\n          key,\n          currentRetainUntil: current.toISOString(),\n          requested: retainUntil.toISOString(),\n        },\n      );\n    }\n    await this.putRetention(key, "COMPLIANCE", retainUntil);\n    const meta = await this.headOrThrow(key);\n    return { ...meta, retainUntil };\n  }',
    },
    properties: [
      {
        title: "6-year floor, never silently shortened",
        body: "`retainUntilFrom(now, years)` throws a ValidationError if `years` is below MIN_RETENTION_YEARS (6, matching HIPAA §164.316(b)(2) and SEC 17a-4): a too-short term is rejected outright, never auto-extended or silently accepted.",
      },
      {
        title: "Extend-only, never earlier",
        body: "`extendRetention` reads the live lock via GetObjectRetention (never HeadObject, which can silently omit lock fields under a permission gap) and refuses any date that isn't strictly later than the current one.",
      },
      {
        title: "COMPLIANCE escalation is a three-belt opt-in",
        body: "Selecting COMPLIANCE mode requires a typed IrreversibleComplianceOptIn naming the exact bucket, and is refused under NODE_ENV=test and outside NODE_ENV=production; no code path reaches it by accident.",
      },
      {
        title: "Every escalation is chain-evidenced",
        body: "`escalateRetention` applies the store change first, then appends a `retention.escalated` record to the tenant's audit chain; if the chain append fails, the retention change is already applied, and the whole call throws loudly to flag the evidence gap for reconciliation. It is never silently swallowed.",
      },
    ],
    faq: [
      {
        question:
          "What's the difference between GOVERNANCE and COMPLIANCE retention mode?",
        answer:
          "GOVERNANCE can be bypassed by a caller holding s3:BypassGovernanceRetention; COMPLIANCE cannot be bypassed by anyone, including the AWS account root, until the retain-until date passes. Caisson runs GOVERNANCE pre-launch for iteration safety and gates COMPLIANCE behind a typed, unforgeable opt-in plus a production-only check (ADR-0051, ADR-0230).",
      },
      {
        question: "Can a WORM retention date ever be shortened?",
        answer:
          "No. Both extendRetention and the GOVERNANCE→COMPLIANCE escalation path reject any date at or before the current lock: extension only moves a lock later, and escalation only hardens the mode, never the date backward (ADR-0202).",
      },
      {
        question:
          "Does a WORM retention policy make us SOC 2 or HIPAA compliant?",
        answer:
          "No single control does that. The retention floor (6 years, matching HIPAA §164.316(b)(2) and SEC 17a-4) and the Object-Lock enforcement ship the technical control an auditor checks for; audit-worm generates the evidence, it doesn't issue a compliance attestation.",
      },
    ],
    sells: {
      ctaLabel: "See how the Compliance edition ships WORM retention",
      ctaHref: "/compliance",
      edition: "Compliance",
    },
    related: [
      "s3-object-lock",
      "hash-chain-audit-trail",
      "audit-evidence-bundle",
    ],
  },
  {
    slug: "hipaa-technical-safeguards",
    term: "HIPAA technical safeguards",
    cluster: "compliance",
    definition:
      "HIPAA technical safeguards are the five standards in 45 CFR §164.312 — access control (unique IDs, emergency access, auto-logoff, encryption), audit controls, integrity, authentication, and transmission security — protecting ePHI in information systems. Caisson's Compliance edition crosswalks every §164.312 citation to an own-authored canonical control, backing what it implements in code: fail-closed RLS, field encryption, the WORM audit log.",
    artifact: {
      label:
        "hipaaSecurity control pack — 164.312(b) audit controls crosswalked to the WORM audit log",
      lang: "ts",
      code: '{\n  id: "AUDIT.CONTROLS",\n  title: "Audit controls over ePHI systems",\n  family: "Technical Safeguards",\n  statement:\n    "Hardware, software, or procedural mechanisms record and examine activity in systems that " +\n    "contain or use ePHI, so that access and changes are attributable and reviewable.",\n  crosswalk: [\n    { framework: "HIPAA-Security", reference: "164.312(b)" },\n    {\n      framework: "SOC2-TSC",\n      reference: "CC7.2",\n      note: "Satisfied by the immutable audit log.",\n    },\n  ],\n},',
    },
    properties: [
      {
        title: "Own-authored, not ingested",
        body: "hipaa-security.ts is clean-room Caisson prose validated at module load — no NIST 800-66 or SCF (CC-BY-ND) text is copied or paraphrased. Crosswalk references carry only the bare CFR citation id (e.g. 164.312(b)), a factual pointer to the safeguard, never its regulatory text.",
      },
      {
        title: "One canonical control, many framework crosswalks",
        body: "Canonical control ids are framework-agnostic and shared across packs — AUDIT.CONTROLS crosswalks to both HIPAA 164.312(b) and SOC 2 CC7.2 in the same entry, so one control satisfies two frameworks' evidence requirements without duplicating logic.",
      },
      {
        title: "Flag-never-guess evidence",
        body: "A collector never infers a passing status it can't evidence: passResult requires a satisfied automated check, flaggedResult/unresolvedResult mandate a recorded reason, and unresolved evidence hard-blocks the pack — no partial pack ships silently.",
      },
      {
        title: "Six-year retention floor",
        body: "The GOVERNANCE.DOCUMENTATION control ties §164.316's documentation-retention requirement to the WORM retention helper, which enforces the HIPAA six-year floor so evidence can't be disposed of early.",
      },
    ],
    faq: [
      {
        question: "What does HIPAA §164.312 actually require?",
        answer:
          "Five standards: Access Control (a) — with unique user ID (a)(2)(i), emergency access (a)(2)(ii), auto-logoff (a)(2)(iii), and encryption/decryption (a)(2)(iv) as its implementation specifications — plus Audit controls (b), Integrity (c), Person or entity authentication (d), and Transmission security (e). Caisson's hipaa-security.ts pack crosswalks every one of these CFR citations to an own-authored canonical control.",
      },
      {
        question: "Does Caisson make us HIPAA compliant?",
        answer:
          "No — no product makes an organization compliant; that's a determination your organization and its auditor make. Caisson ships the technical controls §164.312 requires (fail-closed tenancy RLS, per-tenant field encryption, an immutable audit log) and generates the evidence pack that documents them.",
      },
      {
        question: "How are HIPAA audit controls (164.312(b)) satisfied?",
        answer:
          "The AUDIT.CONTROLS canonical control crosswalks 164.312(b) to Caisson's WORM audit log — a hash-chained, append-only record where every access and change to ePHI is attributable and reviewable, with a chain-verify collector producing the evidence item at pack-generation time.",
      },
      {
        question:
          "Is the HIPAA control text copied from a third-party catalog?",
        answer:
          "No. Every statement and guidance string is clean-room, Caisson-authored prose (ADR-0057). Only the bare CFR citation identifiers (e.g. 164.312(a)(2)(i)) are used as crosswalk pointers — the regulation itself is public law, never NIST 800-66 or SCF text.",
      },
    ],
    sells: {
      ctaLabel: "See the Compliance edition's HIPAA control pack",
      ctaHref: "/compliance",
      edition: "Compliance",
    },
    related: ["hash-chain-audit-trail", "oscal", "control-to-code-mapping"],
  },
  {
    slug: "soc2-audit-log",
    term: "SOC 2 audit log",
    cluster: "compliance",
    definition:
      "A SOC 2 audit log is the tamper-evident record of security-relevant events a SOC 2 audit checks under CC4.1/CC7.2: who did what, when, provable as complete and unaltered. Caisson's `audit-worm` package ships this as an append-only SHA-256 hash chain anchored in WORM storage, generating the evidence a SOC 2 auditor requires, not a compliance guarantee.",
    artifact: {
      label:
        "verifyChain: recompute + compare each link, then check the trusted anchor",
      lang: "ts",
      code: "export function verifyChain(\n  entries: readonly AuditChainEntry[],\n  anchor?: AuditChainAnchor,\n): ChainVerification {\n  for (let i = 0; i < entries.length; i++) {\n    const entry = entries[i] as AuditChainEntry;\n    const expectedPrev =\n      i === 0 ? null : (entries[i - 1] as AuditChainEntry).hash;\n    if (entry.seq !== i) return { valid: false, brokenAt: i };\n    if (entry.prevHash !== expectedPrev) return { valid: false, brokenAt: i };\n    if (entry.hash !== hashChainLink(entry.prevHash, entry.payload)) {\n      return { valid: false, brokenAt: i };\n    }\n  }\n  if (anchor !== undefined) {\n    // Genesis mismatch -> the chain has the wrong root (a rewrite from entry 0).\n    if (\n      anchor.genesisHash !== undefined &&\n      (entries.length === 0 ||\n        (entries[0] as AuditChainEntry).hash !== anchor.genesisHash)\n    ) {\n      return { valid: false, brokenAt: 0 };\n    }",
    },
    properties: [
      {
        title: "Every entry binds the one before it",
        body: "Each log entry's hash is SHA-256 over its own payload plus the previous entry's hash. Altering, inserting, or dropping a middle entry breaks every hash after it, and `verifyChain` reports the first broken index, not just a pass/fail.",
      },
      {
        title: "A trusted anchor closes the truncation gap",
        body: "Internal consistency alone can't catch a dropped tail or a wholesale-rebuilt fake chain. `audit-worm`'s `AuditChainStore` mints a length-keyed anchor (length, tip hash, genesis hash) after every append and writes it to a write-once WORM key, so a cut tail or forged rewrite fails verification even when the surviving entries hash together cleanly.",
      },
      {
        title: "Append-only by database privilege, not convention",
        body: "Entries land in `audit_chain_entry`, whose migration grants the app role SELECT + INSERT and withholds UPDATE/DELETE. A committed log line is immutable because the DB refuses the write, not because the application chooses not to send one.",
      },
      {
        title: "Concurrent writes can't fork the chain",
        body: "Appends for one tenant serialize under a Postgres advisory lock, backed by a UNIQUE(account_id, seq) constraint; two racing appends that would mint the same sequence number collide and the loser retries against the new tip instead of forking the log.",
      },
    ],
    faq: [
      {
        question: "Does a hash-chained audit log make us SOC 2 compliant?",
        answer:
          "No single control satisfies SOC 2 on its own. The audit log ships the technical control CC4.1/CC7.2 asks for (a tamper-evident record of security-relevant events) and generates the evidence an auditor examines; the audit opinion itself covers your whole control environment, which a code artifact can't certify.",
      },
      {
        question: "What SOC 2 logging requirements does this log satisfy?",
        answer:
          "CC7.2 (detection of unauthorized changes) and CC4.1 (ongoing monitoring), where the auditor's question is whether log integrity is provable, not merely asserted. The chain's `verifyChain` recomputes and compares every link against a WORM-anchored commitment, so tamper, truncation, and wholesale rewrite are each independently detectable.",
      },
      {
        question:
          "Can an admin or a database superuser edit an entry after it's written?",
        answer:
          "Not without it showing. The migration withholds UPDATE/DELETE grants on `audit_chain_entry`, and even a row edited at the storage layer (bypassing the app) breaks that entry's hash link to every entry after it, which `verifyChain` catches at the first broken index.",
      },
      {
        question: "Is this the same thing as the SOC 2 evidence pack?",
        answer:
          "No, it's one input to it. The audit chain is the underlying tamper-evident log; the Compliance edition's evidence pack is the separate, signed bundle that collects the chain's verification result alongside RLS and WORM evidence for the auditor.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel: "See how the Compliance edition ships the audit chain",
      ctaHref: "/compliance",
    },
    related: [
      "append-only-audit-log",
      "hash-chain-audit-trail",
      "audit-evidence-bundle",
    ],
  },
  {
    slug: "row-level-security",
    term: "Row-Level Security (RLS)",
    cluster: "security",
    definition:
      "Row-level security (RLS) is a Postgres feature that filters every query at the database layer so a session only sees rows a policy predicate admits — typically scoped to a tenant id. Caisson's tenancy-rls module makes it fail-closed: FORCE RLS plus a withTenant wrapper mean a query with no bound tenant context returns zero rows, never another tenant's data.",
    artifact: {
      label: "buildTenantPolicySql — FORCE RLS + tenant-column policy",
      lang: "ts",
      code: 'export interface TenantPolicyOptions {\n  /** The tenant-key column. Default `account_id`. */\n  column?: string;\n  /** The role policies apply to (it must NOT be a superuser / BYPASSRLS). Default `app`. */\n  role?: string;\n}\n\n/**\n * SQL that makes `table` fail-closed tenant-isolated: ENABLE + **FORCE** RLS, GRANT CRUD to the\n * app role, and a policy that admits a row only when its tenant column equals the bound GUC.\n * Emitted into the table\'s migration (ADR-0014) so a tenant table can never ship without it.\n */\nexport function buildTenantPolicySql(\n  table: string,\n  { column = "account_id", role = "app" }: TenantPolicyOptions = {},\n): string {\n  return [\n    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,\n    `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`,\n    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${role};`,\n    `CREATE POLICY ${table}_tenant_isolation ON ${table}`,\n    `  USING (${column} = current_setting(\'${TENANT_GUC}\', true))`,\n    `  WITH CHECK (${column} = current_setting(\'${TENANT_GUC}\', true));`,\n  ].join("\\n");\n}',
    },
    properties: [
      {
        title: "FORCE closes the owner loophole",
        body: "Plain ENABLE ROW LEVEL SECURITY still lets the table owner bypass the policy. buildTenantPolicySql always emits FORCE ROW LEVEL SECURITY too, so the policy applies even to that connection — only a genuine superuser or BYPASSRLS role escapes it.",
      },
      {
        title: "withTenant is the sole entry point",
        body: "withTenant opens a transaction, binds the app.current_account GUC, then drops to the non-superuser app role before running the callback. A code path that forgets withTenant entirely never sets the GUC, so the policy predicate compares against null and the query returns nothing — fail-closed by construction.",
      },
      {
        title: "The role itself is verified, not assumed",
        body: "assertRoleNotPrivileged queries pg_roles once per (connection, role) and throws before ever SET LOCAL ROLE-ing into it if that role turns out to be SUPERUSER or BYPASSRLS — a misconfigured role can't silently reopen cross-tenant access with zero runtime signal.",
      },
      {
        title: "Admin writes get their own role, not a bypass",
        body: "The operator mutation surface runs as a separate admin_write role with its own USING(true) policy scoped TO admin_write only — RLS OR-combines permissive policies per role, so admin_write can see every tenant while app's isolation is untouched.",
      },
    ],
    faq: [
      {
        question: "What is Postgres row-level security?",
        answer:
          "Row-level security is a native Postgres feature (since 9.5) that attaches a filter predicate to a table so every SELECT, UPDATE, and DELETE only touches rows the predicate admits — enforced inside the database engine itself, not in application code that can be skipped or gotten wrong.",
      },
      {
        question:
          "Does turning on RLS stop a forgotten tenant filter from leaking data?",
        answer:
          "Not by default — plain ENABLE ROW LEVEL SECURITY still lets the table owner bypass it. Caisson's tenancy-rls module adds FORCE ROW LEVEL SECURITY plus a privileged-role guard, so a query that never binds a tenant context matches nothing instead of returning every tenant's rows.",
      },
      {
        question: "How does multi-tenant RLS work in Caisson?",
        answer:
          "Every tenant table carries a policy comparing its account_id column to a Postgres GUC (app.current_account); withTenant is the only function that sets that GUC, inside a transaction, running as a role verified to be non-superuser — a path that skips withTenant has no GUC bound and reads zero rows.",
      },
      {
        question: "Does RLS alone make us SOC 2 or HIPAA compliant?",
        answer:
          "No — RLS ships the technical access control SOC2 CC6.x and HIPAA 164.312(a) require and generates the isolation proof as a test in the suite, but that control alone isn't compliance. The Compliance edition composes it with the audit chain, WORM evidence, and OSCAL mapping into the full evidence pack an audit needs.",
      },
    ],
    sells: {
      edition: "Base (tenancy-rls, Apache-2.0, free)",
      ctaLabel: "Read how tenancy-rls enforces fail-closed RLS",
      ctaHref: "/docs/base/tenancy-rls",
    },
    related: [
      "hipaa-technical-safeguards",
      "soc2-audit-log",
      "audit-evidence-bundle",
      "control-to-code-mapping",
    ],
  },
  {
    slug: "token-metering",
    term: "Token metering",
    cluster: "ai-infra",
    definition:
      "Token metering means estimating, reserving, and reconciling LLM token usage against its real dollar cost, so a crossed spend cap blocks the next call rather than the wallet drifting unchecked. Caisson's `@caisson/ai-meter` module reserves integer credits against a conservative pre-call estimate, then trues the charge to the provider's actual reported usage: refunding over-reservations, billing shortfalls, never touching floats.",
    artifact: {
      label:
        "reconcile() trues the reservation to actual usage: charge the shortfall or refund the over-reservation",
      lang: "ts",
      code: 'const delta = settledCredits - core.reservedCredits;\nlet refundedCredits = 0;\nlet chargedCredits = 0;\nif (billable && delta > 0) {\n  const res = await debit(tx, {\n    accountId: core.accountId,\n    amount: asCredits(delta),\n    eventType: "feature_debit",\n    feature: INFERENCE_FEATURE,\n    idempotencyKey: `${core.callId}:reconcile`,\n    rounding: actual.roundingCredits,\n  });\n  chargedCredits = delta;\n} else if (billable && delta < 0) {\n  const res = await grant(tx, {\n    accountId: core.accountId,\n    amount: asCredits(-delta),\n    eventType: "feature_grant",\n    feature: INFERENCE_FEATURE,\n    idempotencyKey: `${core.callId}:reconcile`,\n    rounding: actual.roundingCredits,\n  });\n  refundedCredits = -delta;\n}\n// delta === 0 (or a BYOK lane): no credit row moves — the wallet stays put.',
    },
    properties: [
      {
        title: "Estimate before spend",
        body: "A cheap chars/4 heuristic sizes the reservation before the provider answers: conservative (rounds up, assumes a full output budget), so most calls over-reserve; reconcile() trues any residual shortfall afterward.",
      },
      {
        title: "Reconcile to actual",
        body: "After the call, reconcile() computes the real cost from provider-reported tokens and trues the delta: a feature_debit for a shortfall, a feature_grant for an over-reservation, nothing at all when the delta is zero.",
      },
      {
        title: "Idempotent settlement",
        body: "The append-only usage_event (account_id, call_id) UNIQUE constraint is the reconcile anchor: a retried settlement runs exactly once, so a network retry can never double-charge or double-refund.",
      },
      {
        title: "Fail-closed pricing",
        body: "resolvePriceEntry throws on an unknown provider/model rather than metering at zero, and every cost computation is integer-only (BigInt, ceiling division per token leg) so a charge is reproducible to the unit.",
      },
    ],
    faq: [
      {
        question: "What is LLM token metering?",
        answer:
          "LLM token metering is estimating a call's cost before the provider responds, then trueing the charge to its actual reported token usage afterward. Caisson's ai-meter reserves credits pre-call and reconciles the delta post-call, so spend tracks real usage, not a guess.",
      },
      {
        question:
          "How do you meter tokens without overcharging or undercharging?",
        answer:
          "Reserve a conservative estimate up front, then reconcile to the actual afterward: an over-reservation triggers a feature_grant refund, an under-reservation triggers a feature_debit shortfall charge, and a delta of exactly zero moves no credit row at all.",
      },
      {
        question: "Does token metering stop a runaway spend spike?",
        answer:
          "Yes: reserve() checks a per-tenant circuit breaker before every call and evaluates soft/hard spend caps after each fresh, billable reservation (a replay, a zero-credit estimate, or a BYOK call defers cap evaluation to reconcile instead); a crossed hard cap trips the breaker so the next call gets a 402 before the provider is ever invoked.",
      },
      {
        question: "Can we bring our own provider key and skip metering?",
        answer:
          'A BYOK lane (keySource: "tenant") debits $0 from the wallet since you supplied the key, but internal metering (the spend window and caps) still runs, accruing against your actual usage at reconcile.',
      },
    ],
    sells: {
      edition: "AI Production Kit",
      ctaLabel: "See how the AI Production Kit meters every inference call",
      ctaHref: "/ai-kit",
    },
    related: ["llm-cost-control", "ai-spend-circuit-breaker", "ai-guardrails"],
  },
  {
    slug: "fail-closed",
    term: "Fail-closed",
    cluster: "security",
    definition:
      "Fail-closed means a security check that errors, times out, or hits an unexpected state denies access by default, rather than falling through to allow it. Caisson's tenancy-rls module practices this literally: an unbound tenant, an unverified role, or an empty account id each refuse the query outright instead of running it unscoped.",
    artifact: {
      label:
        "assertRoleNotPrivileged: refuse to assume a role Caisson has not verified as unprivileged",
      lang: "ts",
      code: 'async function assertRoleNotPrivileged(\n  tx: TenantExecutor,\n  role: string,\n): Promise<void> {\n  const { rows } = await tx.query<{\n    rolsuper: boolean;\n    rolbypassrls: boolean;\n  }>(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1`, [role]);\n  const row = rows[0];\n  if (!row || row.rolsuper || row.rolbypassrls) {\n    throw new TenancyError(\n      `Refusing to use role "${role}" for tenant isolation: it must exist and be neither SUPERUSER nor BYPASSRLS`,\n    );\n  }\n}',
    },
    properties: [
      {
        title: "Refuse when uncertain, never fall through",
        body: "assertRoleNotPrivileged runs a positive check: the role must exist and must not be SUPERUSER or BYPASSRLS, and it throws on any other outcome (a missing row, an unexpected privilege, a failed query). There is no default branch that proceeds; unresolved is refused.",
      },
      {
        title: "The same posture gates money and licenses, not just rows",
        body: "InsufficientCreditsError closes a request with 402 the instant a wallet cannot cover a metered call, and license-verify treats any malformed, unsigned, or unparseable token as fail-safe-to-community instead of guessing at intent. Three different surfaces share one refusal-by-default shape.",
      },
      {
        title: "withTenant refuses an empty account id outright",
        body: "The tenant-scoping wrapper throws before opening a transaction if accountId.length === 0, so a caller that forgot to resolve a tenant never runs unscoped. It errors immediately instead of quietly defaulting to some global view.",
      },
      {
        title: "Scoped honestly: not every check in Caisson fails closed",
        body: "The registry Worker's license-revocation deny-set is deliberately fail-open: if the cache backing it is unavailable, getDenied returns an empty set rather than blocking every install. Fail-closed is the posture for tenant data, credits, and license validity; availability wins on the revocation cache.",
      },
    ],
    faq: [
      {
        question: 'What does "fail-closed" mean in security design?',
        answer:
          "A fail-closed check denies access the moment it cannot positively confirm a request is safe: an error, a missing value, or an unverifiable state all resolve to deny. Caisson's tenancy-rls module applies this to role checks and tenant scoping, throwing instead of proceeding on any ambiguous input.",
      },
      {
        question:
          "What's the difference between fail-closed and fail-open, and when does each make sense?",
        answer:
          "Fail-open keeps a system running when a check cannot be evaluated, favoring availability; fail-closed denies by default, favoring safety. Caisson picks fail-closed for tenant isolation, credit checks, and license validity, where a wrong allow leaks data or revenue, and fail-open only for the registry's revocation deny-set cache, where a stale check should never break every install.",
      },
      {
        question: "Does every check in Caisson fail closed?",
        answer:
          "No. The registry Worker's license-revocation deny-set is deliberately fail-open for availability: an unavailable cache resolves to an empty deny-set rather than blocking installs. Fail-closed is reserved for checks where a wrong allow is the expensive failure: tenant data access, credit balances, and license validity.",
      },
      {
        question:
          "Do I need a paid edition to get fail-closed tenant isolation?",
        answer:
          "No. tenancy-rls, including assertRoleNotPrivileged and the fail-closed withTenant/withUser wrappers, ships in the Apache-2.0 Base substrate for free. Every paid edition builds on top of that same isolation floor; it is not a gated upsell.",
      },
    ],
    sells: {
      ctaLabel: "See where Caisson fails closed (and where it doesn't)",
      ctaHref: "/security",
    },
    related: [
      "row-level-security",
      "multi-tenant-isolation",
      "field-level-encryption",
      "byok",
    ],
  },
  {
    slug: "multi-tenant-isolation",
    term: "Multi-tenant isolation",
    cluster: "security",
    definition:
      "Multi-tenant isolation guarantees one account's data is never visible to another, enforced at both the database and the application layer so a single missed check can't leak across tenants. Caisson's tenancy-rls package makes withTenant the sole entry to tenant data: skip it and a query has no bound account and returns zero rows, never someone else's.",
    artifact: {
      label:
        "withTenant: the sole entry point to tenant data, fail-closed on a missing account id",
      lang: "ts",
      code: '/**\n * Run `fn` inside a transaction scoped to `accountId`: `SET LOCAL ROLE app` +\n * `set_config(\'app.current_account\', accountId, true)`. The account id must come from a verified\n * session/JWT (ADR-0015); never from request params. An empty id is refused outright (never run\n * unscoped).\n */\nexport async function withTenant<T>(\n  db: Transactor,\n  accountId: string,\n  fn: (tx: TenantExecutor) => Promise<T>,\n): Promise<T> {\n  if (accountId.length === 0) {\n    throw new TenancyError(\n      "Refusing to run a tenant query without an account id",\n    );\n  }\n  return db.transaction(async (tx) => {\n    // Bind the GUC first (as the privileged role), then drop to `app` for the actual work.\n    await tx.query(`SELECT set_config($1, $2, true)`, [TENANT_GUC, accountId]);\n    await ensureRoleGuard(db, tx, "app");\n    await tx.exec(`SET LOCAL ROLE app`);\n    return fn(tx);\n  });\n}',
    },
    properties: [
      {
        title: "One entry point, or no data",
        body: "withTenant is the only function in tenancy-rls that opens tenant access: it refuses to run at all with an empty account id, and the whole call runs inside one transaction so the bound account can never drift mid-query.",
      },
      {
        title: "Account and user access paths never widen each other",
        body: "withTenant binds the account GUC and leaves the user GUC unset; withUser, the identity-to-account bootstrap read (ADR-0176), does the reverse. A table's policy checks one GUC or the other, so neither access path can accidentally see through the grant the other one holds.",
      },
      {
        title: "Role legitimacy checked before every privilege drop",
        body: "Before withTenant ever runs SET LOCAL ROLE app, ensureRoleGuard queries pg_roles and refuses to proceed if that role turns out to be SUPERUSER or BYPASSRLS. A misconfigured privileged role is rejected outright instead of silently reopening cross-tenant access.",
      },
      {
        title: "Isolation survives a connection-pooler reset",
        body: "buildTenantPolicySql wraps the GUC read in NULLIF(current_setting(...), ''): a pooler that resets a custom GUC to an empty string instead of unsetting it would otherwise coincidentally match a row whose column happens to be empty. NULLIF folds that reset value to NULL first, so the comparison denies regardless.",
      },
    ],
    faq: [
      {
        question: "What is multi-tenant isolation?",
        answer:
          "The guarantee that no tenant can read or write another tenant's rows, enforced at more than one layer so a bug in any single layer does not collapse the boundary. Caisson enforces it at the database with Postgres row-level security and at the application with the withTenant entry point, never in application code alone.",
      },
      {
        question:
          "What happens if a developer forgets to scope a query to one tenant?",
        answer:
          "Nothing leaks. Every tenant query in Caisson must run through withTenant, which binds the account id as a Postgres session variable before the query executes. A call outside withTenant has no account bound, so the row-level-security policy compares against null and the query returns zero rows instead of every tenant's.",
      },
      {
        question: "Can a privileged database role bypass tenant isolation?",
        answer:
          "Not through Caisson's own role. Before ever dropping into the app role, ensureRoleGuard checks pg_roles and refuses to proceed if that role is SUPERUSER or BYPASSRLS, so a misconfigured privileged role is rejected rather than silently reopening cross-tenant access.",
      },
      {
        question:
          "Does multi-tenant isolation alone make us SOC 2 or HIPAA compliant?",
        answer:
          "No. It ships the technical control SOC 2 CC6.1 and HIPAA 164.312(a)(1) require for logical access control and generates the isolation proof as a test in the suite, but that control alone is not a compliance certification. The Compliance edition composes it with the audit chain and evidence pack an audit needs.",
      },
    ],
    sells: {
      ctaLabel: "See how Caisson isolates tenants, fail-closed",
      ctaHref: "/security",
    },
    related: [
      "row-level-security",
      "fail-closed",
      "field-level-encryption",
      "per-tenant-encryption-keys",
    ],
  },
  {
    slug: "field-level-encryption",
    term: "Field-level encryption",
    cluster: "security",
    definition:
      "Field-level encryption encrypts individual database columns rather than the whole disk or table, so a leaked backup, replica, or table dump reveals only ciphertext for that field. Caisson's field-crypto package wraps this in a Drizzle customType: plaintext seals to AES-256-GCM on write and opens on read, transparent to every query the app writes.",
    artifact: {
      label:
        "encryptedColumn: a Drizzle customType that seals plaintext to AES-256-GCM on write and opens it on read, transparent to every query",
      lang: "ts",
      code: 'export function encryptedColumn(\n  columnContext: string,\n  cipher: AeadCipher = aesGcm,\n) {\n  return customType<{ data: string; driverData: string }>({\n    dataType() {\n      return "text";\n    },\n    toDriver(plaintext: string): string {\n      return sealField(\n        currentFieldCryptoContext(),\n        columnContext,\n        plaintext,\n        cipher,\n      );\n    },\n    fromDriver(stored: string): string {\n      return openField(currentFieldCryptoContext(), columnContext, stored);\n    },\n  });\n}',
    },
    properties: [
      {
        title: "A Drizzle column type, not an app-code habit",
        body: "encryptedColumn wraps a Postgres text column in a Drizzle customType: toDriver seals plaintext on write, fromDriver opens it on read. Every query that touches the column encrypts or decrypts automatically, so there is no separate encrypt-then-insert call to remember or forget.",
      },
      {
        title: "AES-256-GCM, a fresh nonce every write",
        body: "The cipher is AES-256-GCM through node:crypto's native binding: zero dependency, AES-NI accelerated. Every encrypt draws a new CSPRNG nonce, a (key, nonce) pair is never reused, and a tampered ciphertext or auth tag fails decryption outright rather than returning altered plaintext.",
      },
      {
        title: "AAD locks a ciphertext to its tenant, column, and key version",
        body: "buildAad binds tenant_id, key_version, and the column's stable identity into the AEAD's authenticated data. Move a cell to another tenant or another column and it fails to authenticate on decrypt even though the underlying bytes are unchanged: a cryptographic property, not an application check.",
      },
      {
        title: "Fail-closed: no bound tenant, no encrypt or decrypt",
        body: "encryptedColumn reads currentFieldCryptoContext() from an AsyncLocalStorage the caller binds via withFieldCryptoContext. A query that reaches an encrypted column outside that scope throws instead of encrypting or decrypting under a coerced or missing tenant.",
      },
    ],
    faq: [
      {
        question: "What is field-level encryption?",
        answer:
          "Field-level encryption encrypts specific database columns individually rather than the whole disk, volume, or table. A backup, replica, or direct table read exposes ciphertext for that column while every other field stays in the clear, so the blast radius of a leak is one field, not the whole row.",
      },
      {
        question:
          "How is field-level encryption different from encryption at rest?",
        answer:
          "Encryption at rest (full-disk or TDE) protects data only while the disk is unmounted; once a database connection or query runs, it sees plaintext. Field-level encryption keeps the column ciphertext even from a live query with full table access, since only code holding the tenant's derived key and the bound context can call openField to read it.",
      },
      {
        question:
          "Can an encrypted value be moved to a different tenant or column to read it there?",
        answer:
          "No. The AAD binds tenant_id, key_version, and the column's identity into the authenticated data, so a relocated ciphertext fails AEAD authentication on decrypt and throws instead of returning a different tenant's or column's plaintext.",
      },
      {
        question:
          "Does field-level encryption alone make us HIPAA or SOC 2 compliant?",
        answer:
          "No. Field-level encryption ships the technical control HIPAA 164.312(a)(2)(iv) and SOC 2 CC6.1 expect for data protection and generates the evidence an auditor checks; the certification itself still depends on your organization's administrative controls and the audit process, which Caisson does not perform for you.",
      },
    ],
    sells: {
      ctaLabel: "See how field-crypto encrypts a Postgres column",
      ctaHref: "/marketplace/modules/field-crypto",
    },
    related: [
      "envelope-encryption",
      "per-tenant-encryption-keys",
      "crypto-shredding",
      "byok",
    ],
  },
  {
    slug: "envelope-encryption",
    term: "Envelope encryption (DEK/KEK)",
    cluster: "security",
    definition:
      "Envelope encryption wraps a data-encryption key (DEK) with a key-encryption key (KEK) that never leaves a KMS, so only the wrapped DEK is stored and the raw key material is never persisted. Caisson's KmsKeyProvider generates a DEK per tenant, stores just its KEK-wrapped form, and unwraps it through the KMS port on every read.",
    artifact: {
      label:
        "KmsKeyProvider.provision / keyFor: mint the DEK through the KMS, persist only its KEK-wrapped form",
      lang: "ts",
      code: "export class KmsKeyProvider implements FieldKeyProvider {\n  constructor(\n    private readonly kms: KmsClient,\n    private readonly store: WrappedKeyStore,\n  ) {}\n\n  // Mint a fresh DEK through the KMS; persist only its KEK-wrapped form.\n  async provision(tenantId: string): Promise<number> {\n    const cur = (await this.store.currentVersion(tenantId)) ?? 0;\n    const next = cur + 1;\n    const { wrappedKey } = await this.kms.generateDataKey(tenantId);\n    await this.store.putWrapped(tenantId, next, wrappedKey);\n    await this.store.setCurrentVersion(tenantId, next);\n    return next;\n  }\n\n  // Unwrap the stored DEK through the KMS on every read; plaintext never persists.\n  async keyFor(tenantId: string, keyVersion: number): Promise<Buffer> {\n    const wrapped = await this.store.getWrapped(tenantId, keyVersion);\n    if (wrapped === undefined) {\n      throw new NotFoundError(/* no wrapped DEK for this tenant/version */);\n    }\n    return this.kms.decryptDataKey(tenantId, wrapped);\n  }\n}",
    },
    properties: [
      {
        title: "One KMS port, four drop-in backends",
        body: "KmsClient exposes just three methods (generateDataKey, decryptDataKey, scheduleKeyDeletion), so AWS KMS (awsKmsClient, wired), GCP KMS, Azure Key Vault, and HashiCorp Vault Transit all drop in behind the same interface; the field-crypto column and envelope format never know which one is live.",
      },
      {
        title: "Only the wrapped DEK ever touches storage",
        body: "generateDataKey returns the plaintext DEK and its KEK-wrapped form together; provision() persists only wrappedKey to the WrappedKeyStore. The plaintext key exists in memory just long enough to wrap or to encrypt a field, never logged, never written to disk.",
      },
      {
        title: "Rotation bumps a version, it never re-encrypts",
        body: "provision() increments the tenant's key version and wraps a fresh DEK under it; keyFor(tenantId, v) must still answer any past version forever, because the version travels inside the self-describing envelope, not provider state. No bulk re-encrypt job runs on rotation.",
      },
      {
        title: "A per-scope KEK makes crypto-shred selective",
        body: "Every KMS operation is scoped by a keyId (a tenant or subject id); scheduleKeyDeletion(keyId) destroys only that scope's KEK, so shredding one tenant's key leaves every other tenant's wrapped DEKs, and their ciphertext, unaffected.",
      },
    ],
    faq: [
      {
        question: "What's the difference between a DEK and a KEK?",
        answer:
          "A DEK (data-encryption key) encrypts the actual field value with AES-256-GCM. A KEK (key-encryption key) never touches data directly; it only wraps the DEK. KmsKeyProvider generates a fresh DEK per tenant, then calls the KMS to wrap it under that tenant's KEK before anything is persisted.",
      },
      {
        question:
          "Why wrap a key instead of just encrypting fields with the KMS directly?",
        answer:
          "A KMS call per field would be slow, rate-limited, and expensive at row scale. Envelope encryption calls the KMS once per key operation (generate, unwrap, or shred), while the fast, in-process DEK does the actual AES-256-GCM work on every field read and write.",
      },
      {
        question: "Do I need a cloud KMS to use field-crypto?",
        answer:
          "No. DerivedKeyProvider (HKDF-SHA256, zero infrastructure) is the default; KmsKeyProvider is the opt-in upgrade tier for teams that already run AWS KMS, or want a hardware-backed KEK. Both implement the same two-method FieldKeyProvider port, so swapping one for the other touches no calling code.",
      },
      {
        question:
          "Does KMS-wrapped envelope encryption satisfy an auditor's key-management control on its own?",
        answer:
          "It ships the technical control SOC 2 CC6.1 and HIPAA §164.312(a)(2)(iv) require: a KMS-held key that never leaves the KMS, plus a scheduleKeyDeletion primitive an auditor can test. It generates evidence of that control, but it doesn't make an organization compliant by itself; that determination is the organization's and its auditor's.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel: "See how field-crypto wraps every DEK under a KMS-held KEK",
      ctaHref: "/marketplace/modules/field-crypto",
    },
    related: [
      "field-level-encryption",
      "crypto-shredding",
      "byok",
      "per-tenant-encryption-keys",
    ],
  },
  {
    slug: "crypto-shredding",
    term: "Crypto-shredding",
    cluster: "security",
    definition:
      "Crypto-shredding is cryptographic erasure: destroying a scope's encryption key so every ciphertext it protects becomes permanently unrecoverable, satisfying GDPR and CCPA right-to-erasure requests without deleting rows from an immutable audit chain. Caisson's field-crypto module schedules KEK deletion through a scope tied to one tenant, never a shared key, and mints an audit record carrying no PII.",
    artifact: {
      label:
        "cryptoShred(): destroy the scope's KEK through the KMS port, mint the erasure.crypto-shred audit payload (no PII)",
      lang: "ts",
      code: "export async function cryptoShred(\n  provider: KmsKeyProvider,\n  request: CryptoShredRequest,\n): Promise<CryptoShredReceipt> {\n  const req = parseStrict(cryptoShredRequestSchema, request);\n  const shreddedThroughVersion = await provider.scheduleKeyDeletion(\n    req.keyScopeId,\n  );\n  const auditPayload: JsonValue = {\n    event: ERASURE_CRYPTO_SHRED,\n    method: SHRED_METHOD,\n    tenantId: req.tenantId,\n    subjectId: req.subjectId,\n    reason: req.reason,\n    occurredAt: req.occurredAt,\n    shreddedThroughVersion,\n  };\n  return { shreddedThroughVersion, auditPayload };\n}",
    },
    properties: [
      {
        title: "Refuses a shared scope, not just a tenant's own",
        body: "The KMS port's scheduleKeyDeletion requires an explicit, non-empty keyId; the AWS driver throws rather than falling back to the configured default CMK (ADR-0197), so a per-tenant or per-subject shred can never reach past its own scope into another tenant's key material.",
      },
      {
        title: "Selective because provisioning is per scope",
        body: "KmsKeyProvider provisions one wrapped DEK version per tenant (or per subject, for a finer erasure grain), and scheduleKeyDeletion destroys only that scope's KEK: every other tenant's wrapped DEKs stay live, and unwrapping them continues to work.",
      },
      {
        title: "The audit record carries no PII",
        body: "cryptoShred's payload holds only opaque ids, the legal reason, the erasure instant, and the version destroyed, never the erased data itself, so it can be appended forever to the immutable WORM chain without ever recreating what the shred just destroyed.",
      },
      {
        title: "Fail-closed before the deletion, not after",
        body: "parseStrict validates the erasure request against a .strict() schema before scheduleKeyDeletion ever runs, so a malformed request throws before an irreversible key deletion is scheduled, not after.",
      },
    ],
    faq: [
      {
        question: "What is crypto-shredding?",
        answer:
          "Crypto-shredding (NIST SP 800-88's erasure-by-key-destruction) satisfies a data-erasure request by destroying the encryption key protecting the data rather than deleting the data's rows. Once the key is gone, the ciphertext it protected is permanently unrecoverable, even though the storage holding that ciphertext is never touched.",
      },
      {
        question: "Why crypto-shred instead of just deleting the row?",
        answer:
          "Because the row lives in an append-only, hash-chained audit chain that a DELETE would break (ADR-0055): Caisson never commits plaintext to that chain, only the ciphertext envelope, so destroying the key erases the data while every hash in the chain stays byte-for-byte unchanged and verifyChain still passes.",
      },
      {
        question:
          "Does crypto-shredding satisfy our GDPR Article 17 obligation on its own?",
        answer:
          "Crypto-shredding ships the technical control Article 17 and CCPA §1798.105 ask for, a working erasure mechanism, and generates the audit evidence that a specific scope was destroyed on a specific date, for a specific reason. Whether a given request fully discharges your erasure obligation is a legal determination your organization makes, not a status the code can certify.",
      },
      {
        question: "Can a crypto-shredded key ever be recovered?",
        answer:
          "No. AWS KMS's ScheduleKeyDeletion is irreversible once its pending window elapses, and the local test double marks the scope shredded immediately and permanently for that client instance's lifetime: every ciphertext wrapped under that key becomes inert, by design, with no recovery path.",
      },
    ],
    sells: {
      ctaLabel: "See how field-crypto crypto-shreds a subject's encryption key",
      ctaHref: "/marketplace/modules/field-crypto",
    },
    related: [
      "field-level-encryption",
      "envelope-encryption",
      "per-tenant-encryption-keys",
      "byok",
    ],
  },
  {
    slug: "byok",
    term: "BYOK (bring your own key)",
    cluster: "security",
    definition:
      "BYOK (bring your own key) lets a tenant supply its own AI provider API key instead of the shared lane, encrypted at rest under a per-tenant field-crypto envelope. Caisson's ai-kit resolves the key at inference time inside a tenant-scoped RLS transaction, debits zero credits on a BYOK-backed call, and never logs or persists the key in the clear.",
    artifact: {
      label:
        "putTenantProviderKey: seals a tenant's own provider key into its field-crypto envelope, upsert not append",
      lang: "ts",
      code: "/**\n * Store (or replace) a tenant's encrypted provider key. Runs inside `withTenant(tx, accountId)`; the\n * `ctx.tenantId` MUST equal that account (the RLS WITH CHECK and the crypto AAD both enforce it). The\n * plaintext key is sealed under the tenant's current envelope version and never persisted in the clear.\n */\nexport async function putTenantProviderKey(\n  tx: TenantExecutor,\n  ctx: FieldCryptoContext,\n  provider: string,\n  plaintextKey: string,\n): Promise<void> {\n  assertProvider(provider);\n  if (plaintextKey.length === 0) {\n    throw new ValidationError(\"ai-kit BYOK: provider key is required\");\n  }\n  const keyVersion = ctx.currentVersion();\n  const ciphertext = sealField(ctx, BYOK_COLUMN_CONTEXT, plaintextKey);\n  await tx.query(\n    `INSERT INTO tenant_ai_credential (id, account_id, provider, key_version, ciphertext, updated_at)\n     VALUES ($1, $2, $3, $4, $5, now())\n     ON CONFLICT (account_id, provider)\n     DO UPDATE SET ciphertext = EXCLUDED.ciphertext, key_version = EXCLUDED.key_version, updated_at = now()`,\n    [randomUUID(), ctx.tenantId, provider, keyVersion, ciphertext],\n  );\n}",
    },
    properties: [
      {
        title: "Reuses field-crypto verbatim, no new crypto",
        body: "putTenantProviderKey seals a tenant's plaintext provider key with the same sealField/openField pair and per-tenant HKDF-derived AES-256-GCM envelope every other encrypted column in Caisson uses; BYOK adds a table, not a cipher.",
      },
      {
        title: "One credential, replace not append",
        body: "tenant_ai_credential holds one current row per (account_id, provider) under a UNIQUE constraint; putTenantProviderKey upserts on conflict, because a rotated API key is a swappable credential, not a data-encryption key with historical ciphertext depending on it.",
      },
      {
        title: "FORCE RLS scopes every read and write",
        body: "buildTenantPolicySql wires the same fail-closed FORCE ROW LEVEL SECURITY policy onto tenant_ai_credential that every tenant table gets; a forged cross-tenant write hits the WITH CHECK clause and a read outside withTenant returns nothing.",
      },
      {
        title: "Owner-gated write, allowlisted zero cost",
        body: "POST /api/byok requires session.role === \"owner\" (ADR-0208, closing a bypass where any seat could rotate the org's shared key); reads stay seat-visible. resolveActionCost zeroes an inference action's credit cost only when that action is explicitly marked BYOK-covered (ADR-0198); an unclassified action still meters, fail-metered by default.",
      },
    ],
    faq: [
      {
        question: "What does BYOK mean for an AI feature?",
        answer:
          "Bring your own key means a tenant supplies its own provider API key (OpenAI, Anthropic, or another supported provider) instead of routing through Caisson's shared key. ai-kit stores it encrypted and resolves it ahead of the shared lane at inference time, so the call runs against the tenant's own provider account, quota, and bill.",
      },
      {
        question: "Does a BYOK key ever sit on Caisson's servers as plaintext?",
        answer:
          "No. putTenantProviderKey seals it into a field-crypto envelope before the write ever reaches Postgres, and getTenantProviderKey decrypts it only inside a withTenant-scoped transaction long enough to build the provider SDK client; the plaintext key is never logged and never persisted outside that envelope.",
      },
      {
        question: "Who can add or rotate a tenant's BYOK key?",
        answer:
          'Only an org owner. POST /api/byok requires session.role === "owner" before accepting a submission, closing a gap where any seat member could otherwise rotate the org\'s shared key or repoint inference at a key they controlled. Reading masked key metadata (provider, last four characters, status) stays open to every seat.',
      },
      {
        question:
          "Does bringing our own provider key make our AI usage HIPAA or SOC 2 compliant?",
        answer:
          "No module makes an organization compliant; that determination belongs to your organization and its auditor. BYOK gives you custody over which provider account a model call actually runs through, the technical control a residency or data-processing requirement points at, and it produces a real key-custody boundary an auditor can inspect.",
      },
    ],
    sells: {
      edition: "AI Production Kit",
      ctaLabel:
        "See how the AI Production Kit's BYOK lane keeps a tenant's key off Caisson's shared lane",
      ctaHref: "/ai-kit",
    },
    related: [
      "field-level-encryption",
      "envelope-encryption",
      "per-tenant-encryption-keys",
      "row-level-security",
    ],
  },
  {
    slug: "per-tenant-encryption-keys",
    term: "Per-tenant key derivation (HKDF)",
    cluster: "security",
    definition:
      "Per-tenant key derivation (HKDF) means generating each tenant's encryption key from one master secret on demand, never storing a distinct key per tenant. Caisson's field-crypto module runs HKDF-SHA256 over the master key, binding tenant id and key version into HKDF's info parameter so every derivation is deterministic, tenant-isolated, and rotation-aware without a key-storage surface.",
    artifact: {
      label:
        "deriveTenantKey: validates every input length, then expands the master key via HKDF-SHA256 into one 32-byte per-tenant key",
      lang: "ts",
      code: 'export function deriveTenantKey(\n  masterKey: Buffer,\n  salt: Buffer,\n  keyVersion: number,\n  tenantId: string,\n): Buffer {\n  if (masterKey.length !== TENANT_KEY_BYTES) {\n    throw new ValidationError(\n      `field-crypto: MASTER_FIELD_KEY must be ${TENANT_KEY_BYTES} bytes, got ${masterKey.length}`,\n    );\n  }\n  if (salt.length !== TENANT_KEY_BYTES) {\n    throw new ValidationError(\n      `field-crypto: FIELD_CRYPTO_SALT must be ${TENANT_KEY_BYTES} bytes, got ${salt.length}`,\n    );\n  }\n  const info = deriveInfo(keyVersion, tenantId);\n  // hkdfSync returns an ArrayBuffer; wrap as a Buffer for the cipher key.\n  return Buffer.from(\n    hkdfSync("sha256", masterKey, salt, info, TENANT_KEY_BYTES),\n  );\n}',
    },
    properties: [
      {
        title: "No per-tenant key is ever stored, only derived",
        body: "deriveTenantKey recomputes the identical 32-byte key every time from one master secret; there is no per-tenant key table to provision, rotate credentials for, back up, or exfiltrate. The master key itself is read once from the validated env and is never logged.",
      },
      {
        title: "Tenant isolation lives in HKDF's info parameter, not the salt",
        body: "deriveInfo binds the tenant id into the string caisson-field-crypto:v<keyVersion>:<tenantId>, exactly the domain-separation input HKDF's info parameter is defined for. Two tenants sharing the identical master key and salt still derive cryptographically independent keys (ADR-0043 Fork 3 confirmed the split).",
      },
      {
        title: "Fail-closed validation before any derivation runs",
        body: "deriveTenantKey asserts the master key and salt are each exactly 32 bytes, and deriveInfo bounds keyVersion to the integer range [1, 65535] and rejects an empty tenantId. Malformed input throws a ValidationError before hkdfSync is ever called, never a silently truncated or padded key.",
      },
      {
        title: "Rotation is a version bump, not a re-encryption migration",
        body: "keyVersion is baked into the same info string a key derives from, so incrementing it changes every newly derived key while records encrypted under an older version still decrypt correctly by re-deriving with the version recorded on them. Rotating forward never touches stored ciphertext.",
      },
    ],
    faq: [
      {
        question:
          "What is HKDF, and why derive a key instead of storing one per tenant?",
        answer:
          "HKDF (HMAC-based Key Derivation Function, RFC 5869) expands one strong secret into as many independent keys as needed, keyed by a context string. field-crypto calls Node's native hkdfSync with SHA-256 to expand one master key into every tenant's 32-byte data-encryption key on demand, so there is no per-tenant key table to provision, back up, or leak.",
      },
      {
        question:
          "How is one tenant's derived key kept isolated from every other tenant's?",
        answer:
          "The tenant id is bound into HKDF's info parameter, not the salt: caisson-field-crypto:v<keyVersion>:<tenantId>. Two tenants deriving from the identical master key and salt still get cryptographically independent keys, because info is exactly the domain-separation input HKDF defines it for (ADR-0043 Fork 3).",
      },
      {
        question: "What happens to existing encrypted data when a key rotates?",
        answer:
          "Nothing gets re-encrypted. The key version is part of the same info string a key derives from, so bumping keyVersion changes what new writes derive while existing records still decrypt correctly by re-deriving with the version already recorded on them.",
      },
      {
        question:
          "Does per-tenant key derivation alone make us GDPR or HIPAA compliant?",
        answer:
          "No. It ships the technical control GDPR Article 32 and HIPAA 164.312(a) expect, cryptographically isolated per-tenant keys. It does not itself constitute a compliance certification.",
      },
    ],
    sells: {
      ctaLabel: "See how field-crypto derives every tenant's key with HKDF",
      ctaHref: "/marketplace/modules/field-crypto",
    },
    related: [
      "field-level-encryption",
      "envelope-encryption",
      "byok",
      "crypto-shredding",
    ],
  },
  {
    slug: "offline-license-verification",
    term: "Offline license verification",
    cluster: "licensing",
    definition:
      "Offline license verification is checking a signed license token's authenticity and entitlements with no network call, against a public key baked into the software itself. Caisson's license-verify package verifies the Ed25519 signature over canonicalized claims, then trusts only the signed tier; any failure, from a missing token to an elapsed expiry, resolves safely to the free community tier.",
    artifact: {
      label:
        "verifyLicenseWithKey: every failure path (bad signature, unparsable claims, an expired token) resolves to the free community tier, never a thrown error",
      lang: "ts",
      code: 'export function verifyLicenseWithKey(\n  token: string | null | undefined,\n  publicKey: KeyObject,\n  now: Date = new Date(),\n): VerifiedLicense {\n  if (token === null || token === undefined || token === "") {\n    return COMMUNITY;\n  }\n  try {\n    const decoded = decodeToken(token);\n    const signedBytes = Buffer.from(decoded.payload, "utf8");\n\n    // Asymmetric verify over the EXACT signed bytes (Ed25519: algorithm = null). `crypto.verify`,\n    // not `timingSafeEqual`: a signature check is not a secret comparison (ADR-0010).\n    if (!cryptoVerify(null, signedBytes, publicKey, decoded.signature)) {\n      return COMMUNITY;\n    }\n\n    const parsed = licenseClaimsSchema.safeParse(\n      JSON.parse(decoded.payload) as unknown,\n    );\n    if (!parsed.success) {\n      return COMMUNITY;\n    }\n    const claims = parsed.data;\n\n    // ... format-conformance (canonicalize(claims) === decoded.payload) and expiry checks follow,\n    // each failing safe to COMMUNITY too ...\n\n    return { valid: true, tier: claims.tier, entitlements: claims.entitlements, claims };\n  } catch {\n    // Any unexpected throw (JSON parse, codec edge, crypto) → community. The verifier never raises.\n    return COMMUNITY;\n  }\n}',
    },
    properties: [
      {
        title: "Baked-in key, zero network dependency",
        body: "The production verifier pins to one Ed25519 public key (LICENSE_PUBLIC_KEY_SPKI_B64) compiled straight into the package. No request ever leaves the install to check a license; verification is a local crypto.verify() call against that fixed key.",
      },
      {
        title: "Fail-safe-to-community on every error path",
        body: "A null or absent token, a bad signature, a claims payload that fails strict Zod parsing, a non-canonical signed payload, or an elapsed expiry all resolve to the identical free COMMUNITY result. verifyLicenseWithKey has no throwing path a caller has to guard against.",
      },
      {
        title: "Canonical-bytes check closes a forging gap",
        body: "The decoded payload must equal canonicalize(claims) exactly, so a signature that would verify over some other serialization of the same fields (reordered keys, different whitespace) is still rejected. The issuer always signs canonical bytes; anything else is treated as crafted.",
      },
      {
        title: "Perpetual-per-major expiry, never silently extended",
        body: "claims.expiry of null means the license never lapses for the major version it was signed against; a set expiry is checked against the caller-supplied clock. A license never auto-extends itself into a later major it wasn't issued for.",
      },
    ],
    faq: [
      {
        question:
          "How does offline license verification work without phoning home?",
        answer:
          "The verifier ships with one Ed25519 public key baked into the package at build time. It checks a token's signature against that key locally with node:crypto's verify(), then reads the tier and entitlements straight out of the signed claims. There is no license-server round trip and no network egress at verify time.",
      },
      {
        question:
          "What happens if a license token is missing, tampered with, or expired?",
        answer:
          "Every one of those cases returns the same result: the free community tier, zero entitlements, valid set to false. verifyLicenseWithKey never throws, so a corrupted, forged, or absent token degrades an install to the free tier instead of crashing it.",
      },
      {
        question:
          "Can a license token be edited or replayed to unlock a paid tier?",
        answer:
          "Editing any claim breaks the Ed25519 signature over the exact canonical bytes the issuer signed, so a tampered token fails verification. A byte-identical replay still only grants what it was originally signed for, and the wire format's cosmetic prefix and tier label are never trusted; only the signed payload's tier field is authoritative.",
      },
      {
        question:
          "Does offline verification support revoking a license after it ships?",
        answer:
          "Not by itself. A signed token that verifies once verifies until its expiry, or forever for a perpetual major, and an air-gapped check has no revocation list to consult. Caisson enforces revocation on the network-connected surfaces instead, the license-issuer and entitlement-resolver paths, for accounts that need a license pulled.",
      },
    ],
    sells: {
      ctaLabel:
        "See the perpetual license every Caisson purchase activates offline",
      ctaHref: "/marketplace/plans",
    },
    related: [
      "ed25519-license-keys",
      "software-entitlement",
      "credit-based-billing",
      "self-hosted-npm-registry",
    ],
  },
  {
    slug: "ed25519-license-keys",
    term: "Ed25519 license keys",
    cluster: "licensing",
    definition:
      "Ed25519 license keys are the asymmetric key pair behind Caisson's offline licensing: the issuer holds a private Ed25519 key and signs a buyer's exact license claims; Caisson's registry license gate verifies that signature offline against a baked-in public key, with no network call and no way to forge a license without the private key.",
    artifact: {
      label:
        "issueLicense: canonicalize the parsed claims, sign via the Signer port, then frame the wire token",
      lang: "ts",
      code: "export async function issueLicense(\n  signer: Signer,\n  claims: unknown,\n): Promise<string> {\n  const parsed: LicenseClaims = licenseClaimsSchema.parse(claims);\n  // Sign EXACTLY what the verifier re-derives: canonicalize the PARSED object (key-order independent).\n  const payload = canonicalize(parsed as unknown as JsonValue);\n  const signature = await signer.sign(new TextEncoder().encode(payload));\n  if (signature.length !== ED25519_SIGNATURE_BYTES) {\n    throw new ValidationError(\n      `issued signature must be ${String(ED25519_SIGNATURE_BYTES)} bytes, got ${String(signature.length)}`,\n    );\n  }\n  return encodeToken({\n    prefix: WIRE_PREFIX,\n    tier: parsed.tier.toUpperCase(),\n    payload,\n    signature: Buffer.from(signature),\n  });\n}",
    },
    properties: [
      {
        title: "One shared claims schema, no drift",
        body: "The issuer imports licenseClaimsSchema, the LicenseClaims type, and encodeToken straight from @caisson/license-verify instead of re-declaring them, so the signer and the verifier can never disagree on what a valid claim looks like.",
      },
      {
        title: "The private key stays an opaque node:crypto KeyObject",
        body: "Ed25519Signer holds the key in a #private field; node:crypto never exposes its bytes through enumeration, logging, or JSON.stringify, and crypto.sign performs the signature in-engine rather than in JS memory.",
      },
      {
        title: "Signs the canonical bytes, not the raw input",
        body: "issueLicense signs canonicalize(parsed claims), the identical byte sequence @caisson/license-verify re-derives and compares; a one-byte mismatch anywhere makes the verifier reject the signature outright.",
      },
      {
        title: "KMS is a documented seam, not a v1 dependency",
        body: "A KmsSigner interface implements the same Signer port for an AWS KMS asymmetric key whose private half never leaves the HSM, but no AWS SDK ships and no live KMS call exists in this version.",
      },
    ],
    faq: [
      {
        question: "Why Ed25519 instead of RSA or a JWT library for licensing?",
        answer:
          "Ed25519 produces a fixed 64-byte signature with no padding scheme to get wrong, verifies fast enough for a CLI or CI check, and needs nothing beyond node:crypto on both the issuer and the offline verifier, so buyers never install a signing library just to check a license.",
      },
      {
        question: "Where does the private signing key actually live?",
        answer:
          "Only inside the license-issue service, as an opaque node:crypto KeyObject loaded from the CAISSON_LICENSE_SIGNING_KEY env var. It never leaves that process, never gets logged, and @caisson/license-issue itself is marked private and never published, so the signing code can't ship in a buyer's tarball.",
      },
      {
        question: "Can a license be checked without calling Caisson's servers?",
        answer:
          "Yes. @caisson/license-verify bakes the production Ed25519 public key and checks the signature locally with node:crypto, so a license verifies in an air-gapped deployment with zero network calls.",
      },
      {
        question:
          "Does a compromised database let someone mint their own license?",
        answer:
          "No. POST /issue resolves entitlements from the account's own row under RLS before signing, so a caller can only receive what it already purchased, and no one can forge the signature itself without the private key that never leaves the issuer.",
      },
    ],
    sells: {
      ctaLabel: "See how a Caisson purchase becomes a signed license",
      ctaHref: "/marketplace/plans",
    },
    related: [
      "offline-license-verification",
      "software-entitlement",
      "self-hosted-npm-registry",
    ],
  },
  {
    slug: "software-entitlement",
    term: "Software entitlement",
    cluster: "licensing",
    definition:
      "A software entitlement is the record of exactly which purchased ids (editions, bundles, individual modules) an account is currently allowed to use. Caisson resolves entitlements from a signed license token at the registry edge, cross-checked against a live revocation deny-set, so a lapsed or revoked purchase reverts to the free base view immediately.",
    artifact: {
      label:
        "makeLicenseEntitlementResolver: verify the license token, check the edge revocation deny-set, return the entitlement ids or null",
      lang: "ts",
      code: 'export function makeLicenseEntitlementResolver(\n  getDenied: () => ReadonlySet<string>,\n  verify: (token: string) => VerifiedLicense = verifyLicense,\n): (request: Request) => readonly string[] | null {\n  return (request: Request): readonly string[] | null => {\n    const header = request.headers.get("authorization");\n    if (header === null) return null;\n    const match = BEARER_RE.exec(header.trim());\n    const token = match?.[1];\n    if (token === undefined) return null;\n    const verified = verify(token);\n    if (!verified.valid || verified.claims === null) return null;\n    // Edge revocation gate: an operator-revoked license id resolves to community, base-only.\n    if (getDenied().has(verified.claims.licenseId)) return null;\n    return verified.entitlements;\n  };\n}',
    },
    properties: [
      {
        title: "Signed claims decide, never the wire tier",
        body: "The resolver never trusts the token's cosmetic TIER string. verifyLicense checks the cryptographically signed claims.entitlements field alone, so editing the wire tier without a matching signature grants nothing.",
      },
      {
        title: "Fail-safe to the base view, never throws",
        body: "verifyLicense never throws: an absent, malformed, forged, or expired token all resolve to null, and the caller then serves the free base-only view. A verification bug degrades a paid account to community rather than crashing the request.",
      },
      {
        title: "Refcounted grants survive losing one source",
        body: "The entitlement_grant junction stores one row per account, entitlement, and source. An account holds an entitlement while at least one active grant backs it, so a subscription and a one-time purchase of the same edition each have to be revoked before access is lost.",
      },
      {
        title: "Revoked, never deleted",
        body: "A revoke flips status to 'revoked' and stamps revoked_at rather than deleting the row, preserving the audit trail. The edge resolver also checks a live revocation deny-set keyed on the license id, so an operator-revoked license reverts to the base view immediately, without waiting for the token to expire.",
      },
    ],
    faq: [
      {
        question: "What is a software entitlement?",
        answer:
          "A software entitlement is the specific set of purchased ids, editions, bundles, or individual modules, an account is currently allowed to use. Caisson resolves it at request time from a signed license token, not from a client-supplied claim, so the caller can never assert its own access.",
      },
      {
        question:
          "How does Caisson check entitlements at the edge without a database round trip?",
        answer:
          "The registry Worker verifies the license token offline against a baked-in Ed25519 public key, no network call needed to check the signature, then checks the signed claims.licenseId against a live revocation deny-set cached at the edge. No token, or a token that fails either check, resolves to null and the community base-only view.",
      },
      {
        question:
          "If I hold the same edition from two sources (say a subscription plus a one-time purchase), what happens if I cancel one?",
        answer:
          "Nothing changes. The entitlement_grant store keeps one row per account, entitlement, and source, so two active sources both have to be revoked before the entitlement is actually lost. Canceling the subscription revokes only its row; the one-time grant keeps the edition entitled.",
      },
      {
        question:
          "Can a cryptographically valid license still be denied access?",
        answer:
          "Yes. verifyLicense checks the signature, but the resolver then checks the license id against a live revocation deny-set. An operator-revoked license verifies as valid and is denied anyway, reverting the account to the free base view.",
      },
    ],
    sells: {
      ctaLabel: "See what buying a Caisson plan entitles you to",
      ctaHref: "/marketplace/plans",
    },
    related: [
      "offline-license-verification",
      "ed25519-license-keys",
      "credit-based-billing",
      "self-hosted-npm-registry",
    ],
  },
  {
    slug: "credit-based-billing",
    term: "Credit-based billing",
    cluster: "licensing",
    definition:
      "Credit-based billing meters usage as prepaid, integer credit units debited atomically before the paid work runs, rather than as raw dollars settled after the fact. Caisson's credits package inserts an append-only ledger event and decrements an account's wallet in one transaction: an insufficient balance throws before any work starts, and the balance never goes negative.",
    artifact: {
      label:
        "debit() in packages/credits/src/credits.ts: atomic ledger insert + wallet decrement; an insufficient balance throws and rolls both back",
      lang: "ts",
      code: "export async function debit(\n  tx: TenantExecutor,\n  input: DebitInput,\n): Promise<CreditResult> {\n  assertPositiveInt(input.amount);\n  // ... idempotency + feature-tag resolution elided\n  const fresh = await insertEvent(tx, {\n    accountId: input.accountId,\n    eventType: input.eventType,\n    amount: -input.amount,\n    // ...\n  });\n  if (!fresh) return { balance: await balance(tx, input.accountId), idempotent: true };\n  const updated = await tx.query<{ balance: number }>(\n    `UPDATE credit_wallet SET balance = balance - $2\n     WHERE account_id = $1 AND balance >= $2\n     RETURNING balance`,\n    [input.accountId, input.amount],\n  );\n  if (updated.rows.length === 0) {\n    // Insufficient: rolls back the transaction, a failed debit leaves no trace (ADR-0007).\n    throw new InsufficientCreditsError(input.amount, await balance(tx, input.accountId));\n  }\n  return { balance: updated.rows[0]?.balance ?? 0, idempotent: false };\n}",
    },
    properties: [
      {
        title: "Integer-only, branded credits",
        body: "Every credit amount is a branded Credits integer minted through asCredits (ADR-0007/ADR-0212); there is no float anywhere in the ledger, so a debit and its balance always resolve to the exact same whole number.",
      },
      {
        title: "Debit-before-spend, atomic",
        body: "grant() and debit() insert the ledger event and touch the wallet balance inside the same transaction; when the WHERE balance >= amount guard on the wallet UPDATE matches zero rows, InsufficientCreditsError throws and the ledger insert rolls back with it, so a failed debit leaves no trace.",
      },
      {
        title: "Idempotent on a caller key or provider event id",
        body: "insertEvent's INSERT ... ON CONFLICT DO NOTHING RETURNING absorbs a retried grant or debit without aborting the surrounding transaction; a caught unique-violation would poison it, so the conflict is swallowed instead and the call returns the current balance with idempotent: true.",
      },
      {
        title: "A non-negative wallet, enforced twice",
        body: "credit_wallet carries its own credit_wallet_balance_nonneg CHECK constraint, backstopping the application-level WHERE balance >= $2 guard even against a bug or a direct write that bypasses debit() entirely.",
      },
    ],
    faq: [
      {
        question: "What is credit-based billing?",
        answer:
          "Credit-based billing meters usage as prepaid integer credits instead of raw dollars: an account holds a balance from a purchase, subscription allotment, or top-up, and every metered action debits a fixed or computed number of credits from it before the action runs.",
      },
      {
        question:
          "Why debit credits before the work runs instead of billing usage afterward?",
        answer:
          "Debit-before-spend turns a runaway usage spike into an immediate 402 instead of a surprise invoice weeks later: the balance check and the ledger debit happen atomically in one transaction, so there is no window where usage outruns what was actually paid for.",
      },
      {
        question:
          "What happens if a debit and a refund's clawback race on the same account?",
        answer:
          "Both compete for the same wallet row; clawback() takes a row lock (SELECT ... FOR UPDATE) before reading the balance, so a concurrent debit cannot decrement it out from under the calculation, and clawback only ever reclaims the lesser of the amount and the current balance, never pushing the wallet negative.",
      },
      {
        question: "Can a credit debit ever push a balance negative?",
        answer:
          "No: the wallet UPDATE only matches WHERE balance >= amount, so an insufficient balance returns zero rows, the surrounding transaction throws InsufficientCreditsError, and the ledger row that would have recorded the debit rolls back with it. The wallet's own DB CHECK constraint holds even against a bug that skips debit() entirely.",
      },
    ],
    sells: {
      ctaLabel: "See how Caisson prices usage with prepaid credits",
      ctaHref: "/marketplace/plans",
    },
    related: [
      "software-entitlement",
      "offline-license-verification",
      "ed25519-license-keys",
    ],
  },
  {
    slug: "self-hosted-npm-registry",
    term: "Self-hosted npm registry",
    cluster: "licensing",
    definition:
      "A self-hosted npm registry serves private packages through the standard npm install protocol from infrastructure you control, rather than a third-party host. Caisson runs one on a Cloudflare Worker: it answers `bun install @caisson/<module>` with real abbreviated packuments and tarballs from R2, gated by the same offline license-token check as the public index, no forked npm client required.",
    artifact: {
      label:
        "gateStatus + the packument route: the same offline-Ed25519 entitlement check the index Worker uses, gating every `bun install`",
      lang: "ts",
      code: '// D3 gate: entitled → allowed (null); unentitled + no auth → 401 (retry with token); unentitled +\n// auth present → 404 (indistinguishable from unknown, ADR-0076 no-existence-leak).\nfunction gateStatus(\n  entitled: Set<string>,\n  id: string,\n  hasAuth: boolean,\n): number | null {\n  if (entitled.has(id)) return null;\n  return hasAuth ? 404 : 401;\n}\n\n// ...\n\nconst pk = PACKUMENT_RE.exec(path);\nif (pk) {\n  const name = pk[1];\n  if (name === undefined) return errorJson(404, "not_found");\n  const id = `@caisson/${name}`;\n  const status = gateStatus(entitled, id, hasAuth);\n  if (status !== null) return errorJson(status, "not_found");\n  return json(\n    abbreviatedPackument(validated, sidecar, id, url.origin),\n    200,\n  );\n}',
    },
    properties: [
      {
        title: "Reuses the index Worker's entitlement math, not a second gate",
        body: "entitledSet() runs the same baseModuleIds() union expandEntitlements() computation the read-only index route already runs; the npm surface doesn't reimplement license checking, it calls the injected resolveEntitlements against the same offline-Ed25519 verify.",
      },
      {
        title: "No-existence-leak gating",
        body: "gateStatus() returns 401 (retry with a token) when the request carries no Authorization header, and 404 (indistinguishable from an unknown package) when it does and still isn't entitled, so a probe can never learn whether an unpurchased module even exists (D3, ADR-0076).",
      },
      {
        title: "Real abbreviated packuments, not a redirect",
        body: "abbreviatedPackument() synthesizes the application/vnd.npm.install-v1+json shape straight from the inlined index plus the tarball sidecar, exposing only versions actually packed and uploaded to R2, so the client resolves a normal dependency tree with no forked install tool.",
      },
      {
        title: "Every response is per-caller, never shared across buyers",
        body: "gatedHeaders() stamps cache-control: private, no-store and Vary: Authorization on every packument and tarball response, so a commercial package served against one buyer's license token is never served from a shared cache to a different, unentitled caller.",
      },
    ],
    faq: [
      {
        question:
          "Can I just run `bun install @caisson/compliance` against this?",
        answer:
          "Yes. The Worker speaks the real npm packument and tarball protocol (registry/worker/npm-routes.ts), so bun install or npm install with your license token set as the registry auth token works with no custom client and no forked install tool.",
      },
      {
        question:
          "What stops someone from downloading a module they haven't licensed?",
        answer:
          "Every packument and tarball request runs the same offline-Ed25519 entitlement check the free index already uses. An unentitled request gets 401 with no token or 404 with the wrong one; it never gets the package.",
      },
      {
        question: "Is this a fork of npm, or a hosted npm alternative?",
        answer:
          "Neither. It speaks the exact install protocol npm and bun already implement (abbreviated packuments, npm-shaped tarball URLs), served from Caisson's own Cloudflare Worker and R2 bucket instead of npmjs.com or a third-party host.",
      },
    ],
    sells: {
      ctaLabel: "See the private registry install flow",
      ctaHref: "/docs/getting-started",
    },
    related: [
      "offline-license-verification",
      "ed25519-license-keys",
      "software-entitlement",
      "credit-based-billing",
    ],
  },
  {
    slug: "llm-cost-control",
    term: "LLM cost control",
    cluster: "ai-infra",
    definition:
      "LLM cost control means bounding and predicting LLM inference spend before it happens: pre-call estimates, integer-credit reservations, spend caps, a circuit breaker, and near-duplicate-prompt detection, all enforced before a provider call runs. Caisson's ai-meter package wires these guards together, then trues each reservation to the provider's actual reported usage afterward.",
    artifact: {
      label:
        "checkDedupGate: MinHash/LSH similarity match, run before a reservation is ever made",
      lang: "ts",
      code: "const signature = computeMinHashSignature(\n  shingle(normalizePrompt(core.messages)),\n  numHashes,\n);\nconst bucketKeys = lshBands(signature, bands, rows);\nconst candidates = await config.store.candidates(core.accountId, core.scope, bucketKeys);\n\nlet best: { callId: string; similarity: number; at: Date } | null = null;\nfor (const candidate of candidates) {\n  const similarity = jaccardEstimate(signature, candidate.signature);\n  if (similarity >= threshold && (best === null || similarity > best.similarity)) {\n    best = { callId: candidate.callId, similarity, at: candidate.at };\n  }\n}\n\n// Insert AFTER matching: a call must never match its own just-inserted signature.\nawait config.store.insert(core.accountId, core.scope, bucketKeys, {\n  callId: core.callId,\n  signature,\n  at: new Date(),\n});",
    },
    properties: [
      {
        title: "Every call clears the breaker before it spends anything",
        body: "reserve() checks the circuit breaker first, then estimates the cost and debits the wallet before the provider is ever invoked; an open breaker or a short wallet throws a 402 with nothing written, inside the same withTenant transaction.",
      },
      {
        title: "Dedup detects a repeat before estimate or debit ever run",
        body: "checkDedupGate hashes the prompt into a MinHash/LSH signature and matches it against recent calls, called before reserve(), so a caller can skip the whole reservation on a near-duplicate; the gate only detects, it never auto-skips or moves a wallet credit itself.",
      },
      {
        title: "A crossed hard cap trips the next call, not this one",
        body: "evaluateCaps runs after the reservation that lands spend at or past the hard limit, so that call is already billed; tripBreaker fires from inside the same transaction and the very next reserve() 402s before a provider is touched.",
      },
      {
        title: "Settled to actual usage, not the estimate",
        body: "reconcile() trues the reservation against the provider's reported tokens: a feature_grant refunds an over-reservation, a feature_debit charges a shortfall, and the usage_event (account, call_id) unique constraint makes a retried settlement land exactly once.",
      },
    ],
    faq: [
      {
        question: "How do you stop runaway spend on LLM API calls?",
        answer:
          "Gate every call behind ai-meter's breaker and spend caps. reserve() checks the breaker before the provider is invoked, and a crossed hard cap trips it so the next call 402s before a token is spent, not after a bill arrives.",
      },
      {
        question: "Does deduping prompts actually save money?",
        answer:
          "Yes, for the near-duplicate case a literal retry check misses. checkDedupGate flags a reworded repeat of a recent call by MinHash/LSH similarity before reserve() runs, so a caller can skip the paid reservation and the provider call entirely; it only detects, it never auto-skips.",
      },
      {
        question:
          "Can you control spend on a specific provider, like OpenAI, without switching providers?",
        answer:
          "Yes. ai-meter's price book resolves cost per provider and model at both estimate and reconcile time, so the same guards (dedup, reservation, spend caps, circuit breaker) apply no matter which provider a lane calls.",
      },
      {
        question: "What happens if ai-meter's pre-call estimate is wrong?",
        answer:
          "reconcile() trues it after the call completes: an over-reservation refunds as a feature_grant, an under-reservation charges the shortfall as a feature_debit, both idempotent on (account, call_id) so a retried settlement never double-moves the wallet.",
      },
    ],
    sells: {
      edition: "AI Production Kit",
      ctaLabel: "See how the AI Production Kit controls LLM spend",
      ctaHref: "/ai-kit",
    },
    related: ["token-metering", "ai-spend-circuit-breaker", "ai-guardrails"],
  },
  {
    slug: "ai-spend-circuit-breaker",
    term: "AI spend circuit breaker",
    cluster: "ai-infra",
    definition:
      "An AI spend circuit breaker trips open when a tenant's LLM cost crosses a hard spend cap, blocking every further inference call with a 402 until an operator resets it. Caisson's `@caisson/ai-meter` checks the breaker before every reserve, so a runaway agent loop stops on the next call, not after the invoice.",
    artifact: {
      label:
        "assertBreakerClosed() blocks every reserve while the breaker is open, throwing SpendCapError before the provider is called",
      lang: "ts",
      code: '/**\n * A spend cap reached / circuit breaker open. HTTP 402 (the credit-gate status, ADR-0007) — the\n * tenant has no spendable budget for this call. Metadata only: `details` carries the `scope`, never\n * the spend figures, so the envelope stays redaction-safe (mirrors `InsufficientCreditsError`).\n */\nexport class SpendCapError extends CaissonError {\n  readonly code = "spend_cap_reached";\n  readonly httpStatus = 402;\n  constructor(\n    scope: string,\n    message = "Spend cap reached: circuit breaker open",\n  ) {\n    super(message, { scope });\n  }\n}\n// ...\n/** Throw `SpendCapError` (402) when the breaker is open — the pre-reserve gate. */\nexport async function assertBreakerClosed(\n  tx: TenantExecutor,\n  accountId: string,\n  scope: string,\n): Promise<void> {\n  const status = await readBreaker(tx, accountId, scope);\n  if (status.state === "open") throw new SpendCapError(scope);\n}',
    },
    properties: [
      {
        title: "Checked before every call",
        body: "assertBreakerClosed() runs inside reserve() before any provider call: an open breaker throws SpendCapError (402), so a tripped tenant's next call never even reaches the model.",
      },
      {
        title: "Hard cap trips it, soft cap only warns",
        body: "reserve() evaluates soft and hard spend caps after each fresh, billable reservation. Crossing the soft cap sets softExceeded as a warning only; crossing the hard cap calls tripBreaker() in the same transaction.",
      },
      {
        title: "Fail-closed until an operator clears it",
        body: "The breaker's state lives per (account, scope) and does not auto-heal: only resetBreaker(), an explicit operator path, closes it again, so a runaway loop can't quietly resume spending on its own.",
      },
      {
        title: "A separate gate from content guardrails",
        body: "The breaker blocks on spend alone. @caisson/guardrails' fail-closed guard runs the same call through its own moderation and PII chokepoint (ADR-0063), so a call can be stopped for cost, content, or both, without either gate substituting for the other.",
      },
    ],
    faq: [
      {
        question:
          "What's the difference between a soft cap and a hard cap here?",
        answer:
          "A soft cap only flags reserve()'s response with softExceeded, a warning your app can act on. A hard cap does more: crossing it calls tripBreaker() in the same transaction, and the very next reserve() 402s before the provider is ever invoked.",
      },
      {
        question: "Does the circuit breaker reset itself once spend cools off?",
        answer:
          "No. There's no timer or auto-heal: resetBreaker() is an explicit operator action, so a tripped account stays blocked until a human clears it, closing the runaway-loop gap a self-resetting breaker would reopen.",
      },
      {
        question: "Can a burst of concurrent calls double-spend past the cap?",
        answer:
          "No. The per-tenant spend window mutates only through an atomic upsert, never read-modify-write, so concurrent reserves on one tenant can't race the cap check, and the trip itself lands in the same transaction as the reserve that crossed it.",
      },
      {
        question:
          "Does the spend breaker also block disallowed prompts or outputs?",
        answer:
          "No, that's a separate job. The breaker only tracks dollars; @caisson/guardrails' fail-closed guard runs independently on every gateway call to block content, not cost, so the two compose rather than overlap.",
      },
    ],
    sells: {
      edition: "AI Production Kit",
      ctaLabel: "See the circuit breaker that caps runaway LLM spend",
      ctaHref: "/marketplace/modules/ai-meter",
    },
    related: ["token-metering", "ai-guardrails", "llm-cost-control"],
  },
  {
    slug: "llm-eval-gate",
    term: "LLM eval gate",
    cluster: "ai-infra",
    definition:
      "An LLM eval gate is a CI check that runs a versioned eval suite against a committed golden-file baseline and blocks the merge on any score regression. Caisson's @caisson/ai-evals package compares each eval's mean and per-scorer scores to a JSON baseline file, fails closed when no baseline is committed, and rewrites it only through an explicit BLESS re-baseline step.",
    artifact: {
      label:
        "compareToBaseline: the golden-file regression comparator gateAgainstBaseline calls per eval",
      lang: "ts",
      code: 'export function compareToBaseline(\n  run: EvalRun,\n  baseline: BaselineFile,\n): BaselineComparison {\n  const findings: RegressionFinding[] = [];\n  const prior = baseline.evals[run.name];\n  if (prior === undefined) {\n    findings.push({\n      kind: "missing-baseline",\n      actual: run.score,\n      detail: `no committed baseline for eval "${run.name}"`,\n    });\n    return { eval: run.name, passed: false, findings, blessed: false };\n  }\n  if (run.score + EPS < prior.score) {\n    findings.push({\n      kind: "score-regression",\n      actual: run.score,\n      baseline: prior.score,\n      detail: `score ${run.score} worse than baseline ${prior.score}`,\n    });\n  }\n  // ... scorer-level, fewer-cases, and Wilson-CI-floor checks follow the same pattern\n  return { eval: run.name, passed: findings.length === 0, findings, blessed: false };\n}',
      clause:
        "ADR-0214 (eval-science depth: baseline gate + Wilson-CI floor augmentation)",
    },
    properties: [
      {
        title: "Fails closed with no committed baseline",
        body: "compareToBaseline flags an eval with no matching baseline entry as missing-baseline and fails it outright; the fix is to bless it into existence, never to let an unbaselined eval pass by default.",
      },
      {
        title: "Checks the mean, every named scorer, and the case count",
        body: "A run's aggregate score, each individual scorer's mean, and the dataset's case count are all checked against the committed baseline; a shrunk dataset is flagged too, since fewer cases can flatter a mean without the suite actually improving.",
      },
      {
        title: "One sanctioned rewrite path",
        body: "BLESS=1 bun run eval is the only way the baseline file changes; every other invocation only compares and never writes, so a baseline update always lands as a reviewable diff in the PR.",
      },
      {
        title: "An opt-in Wilson-CI floor beyond the mean",
        body: "wilsonFloor gates the lower confidence bound of a scorer's pass rate on top of the raw threshold, catching a lucky small-sample draw that a flattering mean would let through.",
      },
    ],
    faq: [
      {
        question: "What is a golden-file eval gate in CI?",
        answer:
          "It replays a committed eval suite and compares the result to a committed JSON baseline instead of a live judgment call. @caisson/ai-evals fails the run on any score, per-scorer, or dataset-size regression against that baseline, and on a missing baseline entry too.",
      },
      {
        question: "Does the eval gate call a live LLM model during CI?",
        answer:
          "No. The CLI runs offline and deterministically: model-graded scorers replay a committed cassette rather than calling a live provider, so the gate never depends on a network call or a secret.",
      },
      {
        question:
          "How do you update the baseline after a real quality improvement?",
        answer:
          "Set BLESS=1 and run the eval suite once. gateAgainstBaseline rewrites the committed baseline file from the current runs, merging into any existing entries, and the change lands as a normal, reviewable diff in the PR.",
      },
      {
        question: "Is this eval gate required in a generated buyer project?",
        answer:
          "No. It runs as its own turbo eval task inside this monorepo only; a project generated from create-caisson owns its own eval cadence rather than inheriting this gate.",
      },
    ],
    sells: {
      ctaLabel:
        "See how @caisson/ai-evals gates a PR on golden-file regression",
      ctaHref: "/marketplace/modules/ai-evals",
    },
    related: [
      "token-metering",
      "ai-guardrails",
      "ai-spend-circuit-breaker",
      "governed-agents",
    ],
  },
  {
    slug: "ai-guardrails",
    term: "AI guardrails",
    cluster: "ai-infra",
    definition:
      "AI guardrails are the fail-closed input/output chokepoint every LLM call passes through before a prompt reaches a provider and before its answer reaches a caller: an unconditional credential-shape scan, a swappable content moderator under a deadline, and PII redaction. Caisson's `@caisson/guardrails` blocks on a moderator outage rather than passing text through unchecked.",
    artifact: {
      label:
        "moderate(): the unconditional secret gate, then a fail-closed moderator deadline",
      lang: "ts",
      code: 'async function moderate(\n  stage: "input" | "output",\n  text: string,\n  policy: GuardPolicy,\n  rt: GuardRuntime,\n): Promise<void> {\n  // Unconditional credential-shape gate (ADR-0215): runs before the moderator call.\n  // No policy field, no opt-out: a raw credential in either leg never reaches a moderator.\n  if (looksLikeSecret(text)) block(stage, "secret", false, policy, rt);\n  let result: ModerationResult;\n  try {\n    result = await moderateWithDeadline(\n      policy.moderator,\n      text,\n      policy.timeoutMs ?? DEFAULT_TIMEOUT_MS,\n    );\n  } catch {\n    // Outage / timeout / driver throw -> fail-closed unless explicitly opted out.\n    if (policy.failOpen === true) return;\n    block(stage, "moderation", true, policy, rt);\n  }\n  if (result.flagged) block(stage, result.category, false, policy, rt);\n}',
    },
    properties: [
      {
        title: "Unconditional secret gate",
        body: "Every input and output leg runs `looksLikeSecret` before any moderator call, with no policy field to disable it: a raw credential never reaches a provider or a caller, live moderator or not.",
      },
      {
        title: "Fail-closed on outage",
        body: "`moderateWithDeadline` races the configured moderator against a timeout; a driver throw, a rejection, or a deadline miss blocks the call unless the policy explicitly sets `failOpen: true`.",
      },
      {
        title: "Swappable moderator port",
        body: "A `local` zero-network regex driver, a `provider` driver wrapping an injected HTTP check, or a `custom` hook all implement the same `Moderator` interface, so the gate logic never changes when the driver does.",
      },
      {
        title: "Metadata-only telemetry",
        body: "A block emits a `guardrail.blocked` event to the kernel `EventSink` carrying block metadata only (block id, stage, category, policy, fail-closed flag, tenant), never the flagged text, so the audit trail never re-leaks what it just redacted.",
      },
    ],
    faq: [
      {
        question: "What are AI guardrails?",
        answer:
          "AI guardrails are the enforced chokepoint an LLM call passes through on the way in and the way out: a moderator checks the text for policy violations, an unconditional scan blocks anything shaped like a credential, and PII redaction runs on the input leg, all before a provider or a caller ever sees it.",
      },
      {
        question: "What happens if the content moderator goes down?",
        answer:
          "The call blocks. `guard.ts` fails closed by default: a moderator timeout, rejection, or thrown error is treated as a block, not a pass-through, unless the policy explicitly sets `failOpen: true`.",
      },
      {
        question:
          "Do guardrails stop API keys and secrets from leaking through a prompt?",
        answer:
          "Yes: `looksLikeSecret` runs unconditionally on both the input and output leg before the moderator is even called, with no policy switch to turn it off.",
      },
      {
        question: "Can I use my own moderation provider?",
        answer:
          "Yes: the `Moderator` port ships a `local` regex driver, a `provider` driver that wraps your injected HTTP check, and a `custom` hook, all behind the same fail-closed guard.",
      },
    ],
    sells: {
      edition: "AI Production Kit",
      ctaLabel: "See how guardrails gate every inference call",
      ctaHref: "/marketplace/modules/guardrails",
    },
    related: [
      "llm-cost-control",
      "ai-spend-circuit-breaker",
      "governed-agents",
      "llm-eval-gate",
    ],
  },
  {
    slug: "governed-agents",
    term: "Governed agents",
    cluster: "ai-infra",
    definition:
      "Governed agents are AI coding agents run inside hard boundaries, not given free rein over a machine: a subprocess environment scrubbed to one provider credential, an isolated worktree, and a default-deny tool-call allowlist that validates every argument before anything spawns. Caisson's agent-runner and tool-exec packages ship both boundaries together.",
    artifact: {
      label:
        "createToolExec().run: allowlist lookup, then schema-validate BEFORE spawn, never a shell",
      lang: "ts",
      code: 'async run(\n  name: string,\n  args: unknown,\n  reason?: string,\n): Promise<ExecResult> {\n  const spec = registry.get(name);\n  if (spec === undefined) {\n    throw new NotFoundError(`No command registered for "${name}"`, {\n      command: name,\n    });\n  }\n  const validatedArgs = parseStrict(spec.argsSchema, args);\n  const { stdout, stderr, exitCode } = await execFn(\n    spec.command,\n    validatedArgs,\n    { cwd, timeoutMs },\n  );\n  const result: ExecResult = {\n    command: spec.command,\n    args: validatedArgs,\n    exitCode,\n    stdout,\n    stderr,\n    ok: exitCode === 0,\n    at: now(),\n  };\n  return reason === undefined ? result : { ...result, reason };\n}',
    },
    properties: [
      {
        title: "Env scrubbed to one credential",
        body: "buildEngineEnv() builds the child process environment from scratch off a fixed non-secret passthrough allowlist (PATH, LANG, TERM, TZ and similar) plus only the target provider's routing variable and key; it never spreads process.env, so a subprocess that egresses to a model provider carries no credential beyond that one key.",
      },
      {
        title: "Default-deny tool allowlist",
        body: "tool-exec's registry maps a logical command name to a real executable plus a Zod .strict() argument schema. An unregistered name throws NotFoundError before anything spawns; a registered call is validated against its schema before an argv array is ever built.",
      },
      {
        title: "Validated argv, never a shell",
        body: "A tool call's validated arguments become the exact argv array passed to execFile; execSync, exec, and shell: true never appear in tool-exec, so no user-controlled string is ever concatenated into a shell command.",
      },
      {
        title: "Caller owns every side effect",
        body: "The sandboxed agent runs detached in an isolated worktree and returns a diff, a transcript, and a structured run report; git, PR, and deploy actions stay with the caller, matching agent-runner's stated trust boundary.",
      },
    ],
    faq: [
      {
        question: "What does it mean to sandbox an AI coding agent?",
        answer:
          "The agent runs as a detached subprocess with its own scrubbed environment (one provider credential, no operator secrets, no inherited MCP servers) inside an isolated worktree. agent-runner spawns it this way and hands back a diff, a durable transcript, and a structured run report, never direct access to the caller's shell or config.",
      },
      {
        question: "Can a governed agent still run arbitrary shell commands?",
        answer:
          "No. Every tool call an agent makes through tool-exec is checked against a default-deny allowlist first: an unregistered command name throws NotFoundError before anything spawns, and a registered call's arguments are schema-validated into an execFile argv array, never a shell string.",
      },
      {
        question:
          "If the agent's environment is compromised, can it steal our other API keys?",
        answer:
          "No credential beyond the one configured provider key ever reaches the child process. buildEngineEnv() builds the environment from scratch off a fixed non-secret passthrough list plus that single key; it never spreads process.env, and a leak-guard test asserts this end to end through a real spawn.",
      },
    ],
    sells: {
      edition: "Agentic-Dev",
      ctaLabel: "See how agent-runner sandboxes every governed run",
      ctaHref: "/marketplace/modules/agent-runner",
    },
    related: ["ai-guardrails", "mcp-server", "ai-spend-circuit-breaker"],
  },
  {
    slug: "on-device-vector-search",
    term: "On-device vector search",
    cluster: "ai-infra",
    definition:
      "On-device vector search runs nearest-neighbor embedding lookups locally, inside the application's own SQLite file, with no network round-trip and no vectors leaving the machine. Caisson's local-store package pairs the sqlite-vec vec0 extension with FTS5 in that same file, fusing both rankings by Reciprocal Rank Fusion, so retrieval keeps working with zero embedder configured.",
    artifact: {
      label:
        "hybridSearch fuses the vector KNN leg and the FTS5 leg by Reciprocal Rank Fusion (RRF_K=60), degrading to FTS5-only when the vec leg is empty",
      lang: "ts",
      code: "  hybridSearch(opts: HybridSearchOptions): SearchHit[] {\n    const limit = opts.limit ?? 10;\n    const legLimit = Math.max(limit * 8, 50);\n\n    const vecRanks = this.vecLeg(opts.queryVector, legLimit);\n    const ftsRanks = this.ftsLeg(opts.queryText, legLimit);\n\n    // RRF fusion: every leg a doc appears in contributes 1/(RRF_K + rank); sum across legs.\n    const fused = new Map<number, number>();\n    for (const [rowid, rank] of vecRanks)\n      fused.set(rowid, (fused.get(rowid) ?? 0) + 1 / (RRF_K + rank));\n    for (const [rowid, rank] of ftsRanks)\n      fused.set(rowid, (fused.get(rowid) ?? 0) + 1 / (RRF_K + rank));\n\n    const ranked = [...fused.entries()]\n      // score descending; deterministic tie-break by rowid ascending (stable, env-free).\n      .sort((a, b) => b[1] - a[1] || a[0] - b[0])\n      .slice(0, limit);\n    if (ranked.length === 0) return [];\n\n    return ranked.map(([rowid, score]) => ({ id: this.docId(rowid), score }));\n  }",
    },
    properties: [
      {
        title: "FTS5 is the always-available floor",
        body: "hybridSearch always runs the FTS5 leg; the vector leg runs only when a queryVector is supplied, and a vec backend fault is caught and skipped rather than thrown. No embedder configured, no live vector index, no server down: retrieval degrades to FTS5-only and keeps answering.",
      },
      {
        title: "One fixed formula, not a tunable blend",
        body: "Fusion is Reciprocal Rank Fusion at the standard RRF_K=60: every leg a document appears in contributes 1/(60+rank), summed across legs, then ranked descending with a deterministic rowid tie-break. There is no relevance-scoring knob to mistune and no environment-dependent ordering.",
      },
      {
        title: "The embedder is a port, never a bundled model",
        body: "local-store depends on nothing that opens a socket or loads a model; embed() is an injected Embedder interface the consuming edition wires. An undefined embedder is a first-class, documented mode, not a fallback failure: the FTS5 floor alone runs fully offline.",
      },
      {
        title: "vec0's dimension is fixed at table creation",
        body: "CREATE VIRTUAL TABLE docs_vec USING vec0(...FLOAT[dim]) locks the embedding width when the store opens. upsert() and every query vector are checked against it, and a mismatch throws instead of silently padding or truncating a vector.",
      },
    ],
    faq: [
      {
        question: "What is on-device vector search?",
        answer:
          "Running nearest-neighbor lookups over embedding vectors locally, without a network call to a hosted vector database. Caisson's local-store package embeds sqlite-vec's vec0 extension directly in a SQLite file, so a KNN query is a prepared statement against the same file that holds the FTS5 index: no separate vector-DB service to run or reach.",
      },
      {
        question: "Does offline RAG still work without a network connection?",
        answer:
          "Yes, for retrieval. hybridSearch always runs its FTS5 leg, and the vector leg is skipped, not thrown, when no query embedding is available or the vec backend faults, so a fully offline call still returns ranked results. Only the embed step itself is a network call, and only when a cloud embedder is wired in.",
      },
      {
        question:
          "How do local embeddings get produced without local-store bundling a model?",
        answer:
          "local-store never imports a model or opens a socket. embed() is an Embedder port with a fixed dim, and the consuming edition wires the concrete backend, on-device such as ONNX or cloud. An unconfigured embedder is a documented first-class mode, not an error: retrieval falls back to the FTS5 floor alone.",
      },
      {
        question:
          "How does local-store rank results across a vector search and a keyword search?",
        answer:
          "By Reciprocal Rank Fusion. Each leg's rank contributes 1/(RRF_K + rank), with RRF_K=60, summed per document across whichever legs ran. It is a fixed formula, not a tunable score blend, so identical inputs always produce the identical fused ranking.",
      },
    ],
    sells: {
      edition: "Local-first AI",
      ctaLabel:
        "See how local-store runs hybrid vector and keyword search fully offline",
      ctaHref: "/marketplace/modules/local-store",
    },
    related: ["mcp-server", "ai-guardrails", "governed-agents"],
  },
  {
    slug: "compliance-as-code",
    term: "Compliance-as-code",
    cluster: "compliance",
    definition:
      "Compliance-as-code means the controls, the evidence that they hold, and the audit trail proving neither was altered all run as versioned, tested software rather than a spreadsheet assembled by hand once a year. Caisson's Compliance edition composes a typed control registry, a fail-closed evidence generator, and a WORM-anchored audit chain into one reachable runtime surface.",
    artifact: {
      label:
        "createComplianceEdition: composes SOC2 alerting and CCPA/GDPR retention into one reachable Compliance edition surface, no credential at construction",
      lang: "ts",
      code: "export function createComplianceEdition(\n  options: ComplianceEditionOptions = {},\n): ComplianceEdition {\n  const alertChannels = options.alerting?.channels ?? [];\n  const alertAuditSink =\n    options.alerting?.auditSink ?? createInMemoryAuditSink();\n  const erasureTargets = options.retention?.targets ?? [];\n  const retentionAuditSink =\n    options.retention?.auditSink ?? createCaptureAuditSink();\n\n  return {\n    alerting: {\n      channels: alertChannels,\n      auditSink: alertAuditSink,\n      process: (event, runtime) =>\n        processAlert(event, { ...runtime, channels: alertChannels, auditSink: alertAuditSink }),\n    },\n    // retention composes the same way over @caisson/retention-runner's erasureTargets and\n    // retentionAuditSink (elided; see packages/compliance/src/edition.ts:98-106).\n  };\n}",
    },
    properties: [
      {
        title: "The control registry is code, not a spreadsheet",
        body: "CanonicalControl records are Zod `.strict()`-validated at author time (registry/control.ts): an own-authored requirement statement plus crosswalk references to SOC 2 and HIPAA reference ids, rejected on the first malformed field the same way any other typed domain object in the codebase is.",
      },
      {
        title:
          "Evidence generation is a build artifact, not a snapshot someone remembered to run",
        body: "generateEvidencePack refuses to produce a bundle at all when any control's evidence collector comes back unresolved, and identical evidence always canonicalizes to the same SHA-256, so the pack is reproducible output, not a point-in-time export.",
      },
      {
        title:
          "The audit trail is verified by recomputation, not trusted by timestamp",
        body: "Every mutation lands in a hash-chained, WORM-anchored chain (@caisson/audit-worm) that a compromised admin session can append to but never rewrite; verifyChain recomputes the chain end to end rather than trusting a log line's date.",
      },
      {
        title: "The edition composes primitives, it does not fork them",
        body: "createComplianceEdition wires @caisson/alerting and @caisson/retention-runner into one reachable surface at composition time; neither primitive depends back on the edition (ADR-0003 down-only), and construction alone holds no credential and makes no network call.",
      },
    ],
    faq: [
      {
        question: "What does 'compliance-as-code' mean?",
        answer:
          "Every piece of a compliance program runs as versioned, tested software instead of being assembled by hand: a Zod-validated control registry, an evidence generator that either produces a complete pack or refuses to run, and a hash-chained audit log a function verifies rather than a PDF someone signed.",
      },
      {
        question:
          "Does compliance-as-code mean the Compliance edition makes us SOC 2 or HIPAA compliant?",
        answer:
          "No. Compliance-as-code ships the technical controls a framework's clauses require and generates the evidence an auditor examines; it does not itself constitute a certification. The audit opinion covers your whole control environment, people and process included, which no codebase issues on your behalf.",
      },
      {
        question:
          "How is compliance-as-code different from a compliance checklist tool?",
        answer:
          "A checklist tracks whether a person marked a control done; compliance-as-code runs the control's evidence collector, refuses to assemble a pack when that evidence is missing, and hash-chains every mutation so the underlying claim is checkable, not just recorded.",
      },
      {
        question: "Can the compliance code run without anyone touching it?",
        answer:
          "Evidence generation and audit-chain verification run unattended and fail closed: an unresolved collector blocks the entire pack rather than shipping a partial one. Interpreting that evidence for an auditor, and the organizational controls a framework also requires, stay yours.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel:
        "See how the Compliance edition runs compliance as code, not paperwork",
      ctaHref: "/compliance",
    },
    related: [
      "control-to-code-mapping",
      "oscal",
      "audit-evidence-bundle",
      "worm-audit-log",
    ],
  },
  {
    slug: "mcp-server",
    term: "MCP server (Model Context Protocol)",
    cluster: "ai-infra",
    definition:
      "An MCP server (Model Context Protocol server) exposes tools an AI coding agent can call directly over a standard transport, instead of a bespoke per-agent integration. Caisson's buyer-facing MCP server authenticates every call with a timing-safe Bearer token, gates each tool to the caller's owned entitlements, rate-limits per account, and lets an agent generate a licensed project without a browser.",
    artifact: {
      label:
        "handleToolCall: 404s an unentitled or unknown tool, awaits the rate-limit gate, then dispatches",
      lang: "ts",
      code: "async function handleToolCall(\n  session: McpSession,\n  tool: string,\n  args: unknown,\n): Promise<unknown> {\n  const registration = registry.get(tool);\n  // An unregistered tool, and a tool the caller is not entitled to, are both 404: the edition\n  // tool is invisible, never leaking that it exists to a non-entitled caller.\n  if (\n    registration === undefined ||\n    !isEntitled(session, registration.requiredEntitlement)\n  ) {\n    const retired = retiredTools.get(tool);\n    if (retired !== undefined) throw new RetiredToolError(retired);\n    throw new NotFoundError(`Unknown tool: ${tool}`);\n  }\n  // Abuse-throttle gate (ADR-0112): awaited before dispatching any tool, base or edition. A\n  // genuine deny throws RateLimitError (429); a store fault resolves fail-open (ADR-0112 lock 5).\n  if (options.checkRateLimit !== undefined) {\n    await options.checkRateLimit(session.accountId);\n  }\n  return registration.handler({ session, args });\n}",
    },
    properties: [
      {
        title: "Tools are registered, not hardcoded",
        body: "Editions call registerTool() to add their own buyer tools through the same seam the three base tools (list_modules, describe_module, generate) use; retireTool() marks a name retired (410) instead of silently vanishing, so a name is always exactly one of active, retired, or unknown.",
      },
      {
        title: "Constant-time entitlement gate",
        body: "isEntitled() scans every owned entitlement with no early return and compares each one timing-safe, so an edition tool a buyer does not own renders the identical 404 a nonexistent tool would, never leaking which is which.",
      },
      {
        title: "Rate-limited before every dispatch, not just auth-gated",
        body: "The ADR-0112 checkRateLimit hook is awaited before any tool handler runs, for both base and edition tools. A genuine over-limit throws a 429, but a rate-limit store fault fails open (resolves and alerts) so an infrastructure blip never locks out a paying buyer.",
      },
      {
        title: "One core, two transports",
        body: "The same createMcpServer core binds to a local stdio process (one connection, one buyer) and a network-reachable Streamable-HTTP listener that re-authenticates every request statelessly and refuses to start without an explicit host and origin allowlist (ADR-0161).",
      },
    ],
    faq: [
      {
        question: "What is an MCP server?",
        answer:
          "An MCP server (Model Context Protocol server) is a process that exposes a fixed catalog of callable tools to an AI agent over a standard transport, so the agent lists what is available and invokes a tool by name and arguments instead of a hand-wired integration per agent.",
      },
      {
        question:
          "How does Caisson's MCP server know which tools I'm allowed to call?",
        answer:
          "Every tool call re-checks the caller's owned entitlements against the tool's required entitlement in constant time; a tool you do not own is excluded from list_tools and returns the same 404 a nonexistent tool would, so ownership is never leaked by the error itself.",
      },
      {
        question: "Can I call the MCP server from a script instead of stdio?",
        answer:
          "Yes. The same tool-dispatch core also binds to a Streamable-HTTP listener that re-authenticates the Bearer token on every request and enforces an explicit host and origin allowlist, since a network listener has no one-to-one process-to-buyer binding the way stdio does.",
      },
      {
        question:
          "What happens if I call a tool faster than my rate limit allows?",
        answer:
          "The call gets a 429 RateLimitError with a retry-after before the tool handler ever runs, refilled on a lazy per-account token bucket. Only a fault in the rate-limit store itself fails open; a genuine over-limit deny always throws.",
      },
    ],
    sells: {
      ctaLabel: "Connect your AI agent to the Caisson buyer MCP server",
      ctaHref: "/docs/getting-started",
    },
    related: [
      "token-metering",
      "ai-guardrails",
      "governed-agents",
      "llm-cost-control",
    ],
  },
];

/** Resolve a term's curated `related` slugs against GLOSSARY_TERMS, dropping anything that
 *  doesn't (yet) resolve — a later batch's slug landing early would otherwise 404. */
function resolveRelated(term: GlossaryTerm): GlossaryTerm[] {
  if (!term.related || term.related.length === 0) return [];
  return term.related
    .map((slug) => GLOSSARY_TERMS.find((t) => t.slug === slug))
    .filter((t): t is GlossaryTerm => t !== undefined);
}

/** related-terms — a curated same-cluster link list (Fork D). Rendered as a plain "section" (not
 *  a bespoke component, ADR-0099) so the links read as normal crawlable prose. */
function relatedTermsSection(term: GlossaryTerm): PageSection | undefined {
  const related = resolveRelated(term);
  if (related.length === 0) return undefined;
  return {
    kind: "section",
    eyebrow: "See also",
    children: createElement(
      "ul",
      {
        style: {
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--cs-space-3)",
        },
      },
      related.map((t) =>
        createElement(
          "li",
          { key: t.slug },
          createElement(
            "a",
            {
              href: `/glossary/${t.slug}`,
              // Match the site's existing inline-link convention (e.g. ai-kit/procurement/
              // homepage body copy): inline `color` beats the base.css `a { color: inherit }`
              // reset on specificity without needing a new class or !important.
              style: { color: "var(--cs-link)" },
            },
            t.term,
          ),
        ),
      ),
    ),
  };
}

/** breadcrumbNav — the on-page "Glossary / <term>" trail mirroring the JSON-LD breadcrumb the
 *  route already emits. Reuses <Hero>'s `ctas` slot the same way the module depth page's
 *  breadcrumb does (marketplace/modules/[slug]/page.tsx), with `cs-link` (not a bare `<a>`) so
 *  the link reads as interactive under the `a { color: inherit }` reset (base.css). */
function breadcrumbNav(term: GlossaryTerm) {
  return createElement(
    "nav",
    { "aria-label": "Breadcrumb", className: "cs-footnote" },
    createElement("a", { href: "/glossary", className: "cs-link" }, "Glossary"),
    " / ",
    createElement("span", { "aria-current": "page" }, term.term),
  );
}

/**
 * Builder: GlossaryTerm -> the standard ordered PageSection[] + PageMeta (glossary SPEC §Per-page
 * data shape). One CALLER of the generic `<PageSections>` renderer — the standard order lives
 * here, not in the renderer, which stays a plain switch.
 */
export function glossaryPageSpec(term: GlossaryTerm): PageSpec {
  const sections: PageSection[] = [
    {
      kind: "hero",
      eyebrow: "Glossary",
      title: term.term,
      lede: term.definition,
      ctas: breadcrumbNav(term),
    },
    {
      // No `title` here on purpose: the H1 (hero, above) already carries the term name and its
      // full definition as the lede — a second heading with the identical text is a copy-rules
      // restated-heading bug (no new information). `title` is optional on <Section> (renders
      // nothing when omitted, packages/ui/src/components/section.tsx), so the eyebrow alone
      // stands as the lead-in label for the code artifact that follows (ADR-0242: varied from
      // the bare "Definition" repeat, since the hero above already covers the definition).
      kind: "section",
      eyebrow: "In code",
    },
    {
      kind: "codeArtifact",
      label: term.artifact.label,
      code: term.artifact.code,
    },
    {
      kind: "featureGrid",
      eyebrow: "How it holds",
      items: term.properties.map((p) => ({ title: p.title, body: p.body })),
    },
    {
      kind: "faq",
      title: "Frequently asked",
      items: term.faq,
    },
  ];

  const related = relatedTermsSection(term);
  if (related) sections.push(related);

  sections.push({
    kind: "cta",
    title: `See ${term.term} in the product`,
    primary: { label: term.sells.ctaLabel, href: term.sells.ctaHref },
  });

  return {
    // PageSpec.meta is a PageMeta (raw options), not a built Next Metadata — the route file calls
    // buildMetadata(spec.meta) at the Next boundary (page-sections.ts's declared contract).
    meta: {
      title: term.term,
      description: term.definition,
      path: `/glossary/${term.slug}`,
      type: "article",
    },
    sections,
  };
}
