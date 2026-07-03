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

// The 12 batch-1 terms (renderer + hub + the full 10-term compliance cluster, ADR-0235 Fork C).
// Copy is adversarially verified — do not rewrite; a typo fix is fine, a claim change is not.
// `related` entries are scoped to slugs that resolve WITHIN this batch (later-batch cross-links
// land when those terms ship, per the data-lint in glossary.test.ts).
export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  {
    slug: "worm-audit-log",
    term: "WORM audit log",
    cluster: "compliance",
    definition:
      "A WORM audit log is an audit trail stored write once, read many: entries can be appended but never altered or deleted, not even by an administrator. Caisson's audit-worm package hash-chains each entry, then writes a write-once anchor for the chain to WORM storage on every append, so tamper, truncation, and rewrite each surface on verify.",
    artifact: {
      label:
        "AuditChainStore.append — mint the WORM anchor after every entry, write-once, fail-closed on collision",
      lang: "ts",
      code: 'const entries = await loadEntries(tx, accountId);\nconst anchor = anchorChain(entries);\n\n// The trusted commitment lands in WORM under a LENGTH-keyed, write-once key. A second anchor\n// for the same length (a truncate-then-re-append, a replay) hits the existing immutable object\n// → ArtifactExistsError → ConflictError: the original tip can never be overwritten (TM-H).\ntry {\n  await this.store.put(\n    anchorKey(accountId, anchor.length),\n    encodeAnchor(anchor),\n    {\n      retainUntil,\n      contentType: "application/json",\n    },\n  );\n} catch (err) {\n  if (err instanceof ArtifactExistsError) {\n    throw new ConflictError(\n      "audit chain anchor already exists for this length",\n      { accountId, length: anchor.length },\n    );\n  }\n  throw err;\n}\n\nreturn { entry, anchor };',
    },
    properties: [
      {
        title: "Two composable guarantees, one class",
        body: "AuditChainStore composes the kernel's pure hash-chain algebra with a write-once WORM object store: the DB grant can't be rewritten (no UPDATE/DELETE privilege) and the anchor object can't be overwritten either (a write-once key) — no single control has to hold alone.",
      },
      {
        title: "Every append mints a fresh anchor, in the same call",
        body: "append() inserts the chain entry and, before returning, mints a length-keyed anchor over the resulting chain and writes it write-once to WORM storage — the anchor and the entry it commits to land together, never as a later batch job that could be skipped.",
      },
      {
        title: "Re-anchoring a length collides, it never overwrites",
        body: "A truncate-then-replay or a duplicate append for an already-anchored length hits the WORM store's existing immutable object and throws ConflictError — the original tip can never be silently replaced by a second write.",
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
          "Write Once, Read Many — an object can be created but never modified or deleted once written, enforced by the storage layer itself, not by application convention. Caisson pairs a WORM object store with a hash-chained log so both the log and its integrity commitment are independently tamper-evident.",
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
          "No — it ships the technical control SOC 2 CC7.2 and HIPAA 164.312(b) check for (a tamper-evident, immutable record of activity) and generates the evidence an auditor examines; it does not itself constitute a compliance certification.",
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
        "extendRetention — strictly-later date, mode preserved; escalateToCompliance — GOVERNANCE→COMPLIANCE, same date allowed, never earlier",
      lang: "ts",
      code: '  async extendRetention(\n    key: string,\n    newRetainUntil: Date,\n  ): Promise<ArtifactMeta> {\n    assertSafeKey(key);\n    assertValidRetainUntil(newRetainUntil);\n    const current = await this.currentRetainUntil(key);\n    if (\n      current !== undefined &&\n      newRetainUntil.getTime() <= current.getTime()\n    ) {\n      throw new ValidationError(\n        "audit-worm: retention can only be EXTENDED — the new date must be strictly later than the current lock (ADR-0202)",\n        {\n          key,\n          currentRetainUntil: current.toISOString(),\n          requested: newRetainUntil.toISOString(),\n        },\n      );\n    }\n    await this.putRetention(key, this.mode, newRetainUntil);\n    const meta = await this.headOrThrow(key);\n    return { ...meta, retainUntil: newRetainUntil };\n  }\n\n  async escalateToCompliance(\n    key: string,\n    retainUntil: Date,\n    optIn: IrreversibleComplianceOptIn,\n  ): Promise<ArtifactMeta> {\n    assertSafeKey(key);\n    assertValidRetainUntil(retainUntil);\n    this.assertComplianceAllowed(optIn);\n    const current = await this.currentRetainUntil(key);\n    if (current !== undefined && retainUntil.getTime() < current.getTime()) {\n      throw new ValidationError(\n        "audit-worm: COMPLIANCE escalation cannot shorten retention — the date must be at or later than the current lock (ADR-0202)",\n        {\n          key,\n          currentRetainUntil: current.toISOString(),\n          requested: retainUntil.toISOString(),\n        },\n      );\n    }\n    await this.putRetention(key, "COMPLIANCE", retainUntil);\n    const meta = await this.headOrThrow(key);\n    return { ...meta, retainUntil };\n  }',
    },
    properties: [
      {
        title: "6-year floor, never silently shortened",
        body: "`retainUntilFrom(now, years)` throws a ValidationError if `years` is below MIN_RETENTION_YEARS (6, matching HIPAA §164.316(b)(2) and SEC 17a-4) — a too-short term is rejected outright, never auto-extended or silently accepted.",
      },
      {
        title: "Extend-only, never earlier",
        body: "`extendRetention` reads the live lock via GetObjectRetention (never HeadObject, which can silently omit lock fields under a permission gap) and refuses any date that isn't strictly later than the current one.",
      },
      {
        title: "COMPLIANCE escalation is a three-belt opt-in",
        body: "Selecting COMPLIANCE mode requires a typed IrreversibleComplianceOptIn naming the exact bucket, and is refused under NODE_ENV=test and outside NODE_ENV=production — no code path reaches it by accident.",
      },
      {
        title: "Every escalation is chain-evidenced",
        body: "`escalateRetention` applies the store change first, then appends a `retention.escalated` record to the tenant's audit chain; if the chain append fails, the retention change is already applied, and the whole call throws loudly to flag the evidence gap for reconciliation — it is never silently swallowed.",
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
          "No. Both extendRetention and the GOVERNANCE→COMPLIANCE escalation path reject any date at or before the current lock — extension only moves a lock later, and escalation only hardens the mode, never the date backward (ADR-0202).",
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
      "A SOC 2 audit log is the tamper-evident record of security-relevant events a SOC 2 audit checks under CC4.1/CC7.2: who did what, when, provable as complete and unaltered. Caisson's `audit-worm` package ships this as an append-only SHA-256 hash chain anchored in WORM storage, generating the evidence a SOC 2 auditor requires — not a compliance guarantee.",
    artifact: {
      label:
        "verifyChain — recompute + compare each link, then check the trusted anchor",
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
          "No single control satisfies SOC 2 on its own. The audit log ships the technical control CC4.1/CC7.2 asks for — a tamper-evident record of security-relevant events — and generates the evidence an auditor examines; the audit opinion itself covers your whole control environment, which a code artifact can't certify.",
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
      "Token metering means estimating, reserving, and reconciling LLM token usage against its real dollar cost, so a crossed spend cap blocks the next call rather than the wallet drifting unchecked. Caisson's `@caisson/ai-meter` module reserves integer credits against a conservative pre-call estimate, then trues the charge to the provider's actual reported usage — refunding over-reservations, billing shortfalls, never touching floats.",
    artifact: {
      label:
        "reconcile() — true the reservation to actual usage: charge the shortfall or refund the over-reservation",
      lang: "ts",
      code: 'const delta = settledCredits - core.reservedCredits;\nlet refundedCredits = 0;\nlet chargedCredits = 0;\nif (billable && delta > 0) {\n  const res = await debit(tx, {\n    accountId: core.accountId,\n    amount: asCredits(delta),\n    eventType: "feature_debit",\n    feature: INFERENCE_FEATURE,\n    idempotencyKey: `${core.callId}:reconcile`,\n    rounding: actual.roundingCredits,\n  });\n  chargedCredits = delta;\n} else if (billable && delta < 0) {\n  const res = await grant(tx, {\n    accountId: core.accountId,\n    amount: asCredits(-delta),\n    eventType: "feature_grant",\n    feature: INFERENCE_FEATURE,\n    idempotencyKey: `${core.callId}:reconcile`,\n    rounding: actual.roundingCredits,\n  });\n  refundedCredits = -delta;\n}\n// delta === 0 (or a BYOK lane): no credit row moves — the wallet stays put.',
    },
    properties: [
      {
        title: "Estimate before spend",
        body: "A cheap chars/4 heuristic sizes the reservation before the provider answers — conservative (rounds up, assumes a full output budget) so most calls over-reserve; reconcile() trues any residual shortfall afterward.",
      },
      {
        title: "Reconcile to actual",
        body: "After the call, reconcile() computes the real cost from provider-reported tokens and trues the delta: a feature_debit for a shortfall, a feature_grant for an over-reservation, nothing at all when the delta is zero.",
      },
      {
        title: "Idempotent settlement",
        body: "The append-only usage_event (account_id, call_id) UNIQUE constraint is the reconcile anchor — a retried settlement runs exactly once, so a network retry can never double-charge or double-refund.",
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
          "Yes — reserve() checks a per-tenant circuit breaker before every call and evaluates soft/hard spend caps after each fresh, billable reservation (a replay, a zero-credit estimate, or a BYOK call defers cap evaluation to reconcile instead); a crossed hard cap trips the breaker so the next call gets a 402 before the provider is ever invoked.",
      },
      {
        question: "Can we bring our own provider key and skip metering?",
        answer:
          'A BYOK lane (keySource: "tenant") debits $0 from the wallet since you supplied the key, but internal metering — the spend window and caps — still runs, accruing against your actual usage at reconcile.',
      },
    ],
    sells: {
      edition: "AI Production Kit",
      ctaLabel: "See how the AI Production Kit meters every inference call",
      ctaHref: "/ai-kit",
    },
    // llm-cost-control / ai-spend-circuit-breaker / ai-guardrails ship in the cluster-D batch
    // (ADR-0235 Fork C); no cross-links out of batch 1 yet — see glossary.test.ts's data-lint.
    related: [],
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
    eyebrow: "Related terms",
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
          createElement("a", { href: `/glossary/${t.slug}` }, t.term),
        ),
      ),
    ),
  };
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
    },
    {
      kind: "section",
      eyebrow: "Definition",
      title: term.term,
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
