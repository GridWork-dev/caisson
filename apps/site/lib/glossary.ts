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
// fifth value), plus the AEO/Kickoff-J additions the ADR-0367 expansion batch, and the batch-3 mechanism terms (7 more over
// the post-0235 shipped surfaces: TSA, Rekor, evidence receipts, crosswalk, signed anchors,
// agent trajectory, token hash-at-rest). Copy is adversarially verified per Fork B — do not
// rewrite; a typo fix is fine, a claim change is not. `related` entries are curated same-cluster
// slugs (Fork D).
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
      "An append-only audit log lets entries be inserted but never altered or deleted, enforced at the database-privilege level, not just app code. Caisson hash-chains each entry to its predecessor in the kernel, then the Compliance edition's audit-worm package anchors the chain's length and tip hash write-once to WORM storage, so tampering, reordering, or truncation each surface on verify.",
    artifact: {
      label:
        "verifyChain: recompute + compare each link, return the first broken index",
      lang: "ts",
      code: "export function verifyChain(\n  entries: readonly AuditChainEntry[],\n  anchor?: AuditChainAnchor,\n): ChainVerification {\n  for (let i = 0; i < entries.length; i++) {\n    const entry = entries[i] as AuditChainEntry;\n    const expectedPrev =\n      i === 0 ? null : (entries[i - 1] as AuditChainEntry).hash;\n    if (entry.seq !== i) return { valid: false, brokenAt: i };\n    if (entry.prevHash !== expectedPrev) return { valid: false, brokenAt: i };\n    if (entry.hash !== hashChainLink(entry.prevHash, entry.payload)) {\n      return { valid: false, brokenAt: i };\n    }\n  }",
    },
    properties: [
      {
        title: "Immutable by privilege, not convention",
        body: "The audit_chain_entry table's migration grants the app role SELECT + INSERT only, UPDATE and DELETE are never granted, and FORCE ROW LEVEL SECURITY holds even for the table owner. A compromised or buggy query can append a row; it cannot rewrite or drop one.",
      },
      {
        title: "Each entry hashes over its predecessor",
        body: "Every entry's hash is SHA-256 over a canonicalized [prevHash, payload] tuple, with payload keys deterministically sorted so the hash is reproducible across machines. Edit, reorder, or drop a middle entry and every hash after that point breaks; verifyChain returns the first broken index.",
      },
      {
        title: "A WORM anchor catches what the chain alone can't",
        body: "Internal consistency doesn't prove completeness, a truncated tail or a wholesale-rewritten chain can still verify clean on its own. Every append mints a {length, tipHash, genesisHash} commitment and writes it write-once to WORM object storage, so a length or tip mismatch on read-back proves truncation or rewrite.",
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
          "Three independent mechanisms: the DB grant withholds UPDATE/DELETE entirely, the hash chain makes any interior tamper recompute-detectable, and a WORM-stored anchor (length + tip hash) catches tail truncation or a full rewrite, the one failure mode a self-consistent chain can't see on its own.",
      },
      {
        question:
          "Can someone truncate the tail of the log and have it still look valid?",
        answer:
          "A truncated chain is still internally self-consistent (every remaining hash still recomputes) so no, an append-only log without an external anchor can't catch that on its own. Caisson closes the gap with a trusted {length, tipHash} commitment written to WORM storage after every append; verify checks the DB's current length against it.",
      },
      {
        question:
          "Does an append-only audit log make us SOC 2 or HIPAA compliant?",
        answer:
          "No, it ships the technical control (tamper-evident, privilege-enforced logging) and generates the evidence an auditor asks for; it does not itself constitute compliance. SOC 2 CC7.2 and HIPAA 164.312(b) both expect this class of control, and this is what satisfies the control, not the certification.",
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
        "hashChainLink(): the chain-link hash: SHA-256 over [prevHash, payload]",
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
        body: "canonicalize() recursively sorts object keys before hashing, so two payloads that differ only in key order produce the identical hash. The chain is reproducible across machines, languages, and JSON serializers, the hash input, not just the algorithm, is load-bearing.",
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
        "S3ArtifactStore.put: conditional write-once PUT + Object-Lock retention date",
      lang: "ts",
      code: 'assertSafeKey(key);\nconst command = new PutObjectCommand({\n  Bucket: this.bucket,\n  Key: key,\n  Body: body,\n  ContentLength: body.byteLength,\n  // Write-once: S3 fails a conditional PUT to an existing key with 412 (TM-H).\n  IfNoneMatch: "*",\n  // Retention lock: object date == DB `retain_until` (ADR-0051/0054).\n  ObjectLockMode: this.mode,\n  ObjectLockRetainUntilDate: opts.retainUntil,\n});\ntry {\n  await this.client.send(command);\n} catch (err) {\n  // 412 Precondition Failed == the key already holds an immutable object (WORM violation).\n  if (httpStatusOf(err) === 412) throw new ArtifactExistsError(key);\n  throw err;\n}',
    },
    properties: [
      {
        title: "Write-once PUT enforces WORM before any lock check",
        body: 'Every put() is a conditional PutObjectCommand with IfNoneMatch: "*", S3 answers 412 on an existing key, which the store maps to ArtifactExistsError. No overwrite code path exists independent of the lock itself.',
      },
      {
        title: "COMPLIANCE mode sits behind a three-belt fail-closed gate",
        body: 'assertComplianceAllowed refuses COMPLIANCE under a test runner, refuses it outside NODE_ENV === "production", and refuses it without a typed IrreversibleComplianceOptIn naming the exact bucket, all three checked at construction, before any S3 call.',
      },
      {
        title: "Retention only ever extends or escalates, never shortens",
        body: "extendRetention rejects any date not strictly later than the current lock; escalateToCompliance rejects any date earlier than the current lock. Both read the authoritative lock via GetObjectRetention first, HeadObject silently omits lock fields without s3:GetObjectRetention, which would fail open.",
      },
      {
        title: "The S3 lock date is the database row's date",
        body: "ObjectLockRetainUntilDate is set to the caller's opts.retainUntil on every write, and metaFrom projects it straight back out on get/head, so the retain-until an auditor reads off the S3 object is the same value stored in the DB row, not a derived approximation.",
      },
    ],
    faq: [
      {
        question:
          "What's the difference between GOVERNANCE and COMPLIANCE Object Lock mode?",
        answer:
          "GOVERNANCE is bypassable by an IAM caller holding s3:BypassGovernanceRetention; COMPLIANCE is not, not even the AWS account root can shorten or delete it before the retain-until date. Caisson's audit-worm store picks one mode per bucket (one evidence class) and gates COMPLIANCE behind a typed, explicit opt-in that's refused outside a production deployment.",
      },
      {
        question: "Does S3 Object Lock alone make us SOC 2 or HIPAA compliant?",
        answer:
          "No, Object Lock ships the technical retention control that SOC 2 CC7.x system-operations criteria and HIPAA 164.312(c) integrity requirements check for, and generates the evidence that it's in force. Compliance status is an audit conclusion your assessor reaches; the control is one input to that, not a certification.",
      },
      {
        question: "Can a retention lock be shortened or deleted once it's set?",
        answer:
          "No path in audit-worm shortens a lock or removes COMPLIANCE mode. extendRetention only accepts a strictly-later date and escalateToCompliance only moves GOVERNANCE→COMPLIANCE at an equal-or-later date, both read the current lock via GetObjectRetention first, then refuse anything earlier with a ValidationError before any S3 write (PutObjectRetention) runs.",
      },
      {
        question:
          "Does Object Lock require anything on the S3 bucket beyond writing the API calls?",
        answer:
          "Yes, Object Lock must be enabled on the bucket itself (at creation, with versioning) before any PutObjectRetention call takes effect. Caisson's store assumes an Object-Lock-enabled bucket and fails closed on the application side (write-once PUT, typed COMPLIANCE opt-in) rather than depending on bucket config alone.",
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
      "OSCAL is NIST's machine-readable format (XML or JSON) for security control catalogs, System Security Plans, and Assessment Results, the interchange layer FedRAMP and GRC tools expect. Caisson's Compliance edition maps each signed evidence pack into OSCAL v1.2.2 Security Assessment Results and Plan-of-Action-and-Milestones documents, bundled alongside a per-framework Assessment Plan and a SHA-256 integrity binding.",
    artifact: {
      label:
        "toOscalAssessmentResults: readiness maps to satisfied/not-satisfied, gap reason recorded not guessed",
      lang: "ts",
      code: 'const target: OscalFindingTarget =\n  control.readiness === "ready"\n    ? {\n        type: "objective-id",\n        "target-id": control.controlId,\n        status: { state: "satisfied" },\n      }\n    : {\n        type: "objective-id",\n        "target-id": control.controlId,\n        status: { state: "not-satisfied", remarks: gapReason(control) },\n      };\nfindings.push({\n  uuid: newId(),\n  title: `${control.controlId} — ${control.title}`,\n  description: control.statement,\n  target,\n  "related-observations": related,\n});',
    },
    properties: [
      {
        title: "Two documents, one mapping",
        body: 'The Security Assessment Results (SAR) gets one finding per control plus one observation per evidence item; the Plan of Action & Milestones (POA&M) gets one poam-item per gap control, referencing only the flagged evidence, a clean pack ships zero GAP poam-items, only a single truthful "no open remediation items" entry, which NIST\'s OSCAL schema requires (poam-items is min-1).',
      },
      {
        title: "Deterministic, not generative",
        body: "The wall-clock `now` and the UUID source `newId` are both injected seams (`newId` defaults to `crypto.randomUUID`, so raw output is non-deterministic unless a seam is pinned. With the UUID seam pinned, the same evidence pack canonicalizes to byte-identical OSCAL output) the same discipline the signed evidence pack and the WORM audit chain already run on.",
      },
      {
        title: "Flag-never-guess carries over",
        body: "A not-satisfied finding's `remarks` is the flagged evidence's recorded reason (gapReason()), never an inferred explanation, the canonical manifest it maps from has no unresolved evidence by construction.",
      },
      {
        title: "Bundled and hash-bound, not linked to a dead URL",
        body: "Caisson authors a real per-framework Assessment-Plan and ships it inside the same signed bundle as the SAR and POA&M, referenced by a relative rlink with a SHA-256 hashes[] binding, replacing an earlier caisson.sh link that was never actually served.",
      },
    ],
    faq: [
      {
        question: "What is OSCAL?",
        answer:
          "OSCAL (the Open Security Controls Assessment Language) is NIST's JSON/XML schema for control catalogs, security plans, and assessment results, built so a GRC tool or a FedRAMP reviewer can ingest evidence directly instead of a human re-keying a PDF.",
      },
      {
        question: "Does Caisson generate an OSCAL Assessment Plan?",
        answer:
          "Yes. Each framework ships a real OSCAL v1.2.2 assessment-plan document, bundled alongside the Security Assessment Results and referenced by a relative, SHA-256-hashed rlink, not a placeholder.",
      },
      {
        question: "Does an OSCAL export mean we're SOC 2 or HIPAA compliant?",
        answer:
          "No. The OSCAL bundle is the evidence assessment and gap register (satisfied/not-satisfied per control, POA&M items for any gap) not a compliance certification; it ships the technical readiness picture the framework's own controls require, not a compliance guarantee.",
      },
      {
        question:
          "What OSCAL version does Caisson target, and does it emit XML too?",
        answer:
          "v1.2.2, the single oscal-cli validate conformance target. JSON is the canonical, byte-stable output; an XML sibling is produced by shelling out to NIST's own oscal-cli converter (never a hand-rolled serializer).",
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
        "soc2Tsc control: one canonical control crosswalked to both SOC 2 CC6.1 and HIPAA 164.312(d)",
      lang: "ts",
      code: '{\n  id: "ACCESS-CONTROL.MFA",\n  title: "Multi-factor authentication for privileged access",\n  family: "Access Control",\n  statement:\n    "Privileged access to production systems and the tenant data plane requires a second " +\n    "authentication factor beyond a password; single-factor privileged sessions are denied.",\n  crosswalk: [\n    { framework: "SOC2-TSC", reference: "CC6.1" },\n    {\n      framework: "HIPAA-Security",\n      reference: "164.312(d)",\n      note: "Person-or-entity authentication strengthened by a second factor.",\n    },\n  ],\n},',
    },
    properties: [
      {
        title: "Clean-room control, crosswalked not copied",
        body: "CanonicalControl (registry/control.ts) is own-authored Caisson prose with a `crosswalk` array of `{framework, reference}` pointers, bare requirement IDs like `CC6.1` or `164.312(d)`, never the licensed AICPA/SCF criteria text. Crosswalk entries are validated unique on (framework, reference) at author time.",
      },
      {
        title: "Evidence collectors pin to a controlId",
        body: "Each EvidenceCollector declares the controlId it evidences (e.g. fieldCryptoPolicyCollector defaults to DATA-PROTECTION.PHI-ENCRYPTION) and turns a live at-rest sample into a pass/flagged/unresolved verdict, fail-closed: zero PHI fields inspected returns unresolved, never a guessed pass.",
      },
      {
        title: "Greppable code-to-ADR trail",
        body: 'Control-bearing code carries a one-line `Control: ADR-NNNN, <policy name>` docstring (the soc2Tsc pack cites ADR-0057), so `grep -rn "Control: ADR-" packages/*/src` is the auditor\'s control-to-code index with no separate spreadsheet to drift.',
      },
      {
        title: "Goldens pin the policy revision",
        body: "Golden fixtures capturing control-logic output carry a `policyVersion` field naming the ADR/catalog version the fixture was blessed under, so a drifted golden shows which policy revision the last-blessed evidence belongs to, the code-to-evidence leg of the trail.",
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
          "Yes, a canonical control's crosswalk array can carry references to multiple frameworks. ACCESS-CONTROL.MFA, for example, crosswalks to SOC 2 CC6.1 and HIPAA 164.312(d) from the same own-authored requirement, so one implementation evidences two frameworks at once.",
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
      "An audit evidence bundle is a generated package that ties each compliance control to the artifact proving it holds (logs, config, chain anchors) cited against the exact clause it satisfies. Caisson's version is a signed, deterministic ZIP: byte-stable manifest, fail-closed on any missing evidence, readiness derived from the evidence itself, never asserted.",
    artifact: {
      label:
        "generateEvidencePack - flag-never-guess: refuse the whole pack on any unresolved evidence",
      lang: "ts",
      code: '// PHASE 1 — flag-never-guess. Scan EVERY control for unresolved evidence before assembling\n// anything; refuse the whole pack if any is found. No filesystem touch here → no partial pack.\nconst unresolved: Array<{\n  controlId: string;\n  collectorId: string;\n  reason: string | undefined;\n}> = [];\nfor (const control of input.controls) {\n  for (const result of control.evidence) {\n    if (result.status === "unresolved") {\n      unresolved.push({\n        controlId: control.controlId,\n        collectorId: result.item.collectorId,\n        reason: result.reason,\n      });\n    }\n  }\n}\nif (unresolved.length > 0) {\n  const sortedUnresolved = [...unresolved].sort(\n    (a, b) =>\n      cmp(a.controlId, b.controlId) || cmp(a.collectorId, b.collectorId),\n  );\n  const report = parseEvidencePackBlocked({\n    formatVersion: EVIDENCE_PACK_FORMAT_VERSION,\n    tenantId: input.tenantId,\n    framework: input.framework,\n    blocked: true,\n    unresolved: sortedUnresolved,\n  });\n  throw new EvidencePackBlockedError(report);\n}',
    },
    properties: [
      {
        title: "Fail-closed, not fail-open",
        body: "generateEvidencePack() scans every control for an unresolved collector result before assembling anything. If even one exists, it throws EvidencePackBlockedError with a structured report of exactly what's missing, no partial or best-effort pack is ever produced.",
      },
      {
        title: "Readiness is derived, never asserted",
        body: 'A control\'s readiness ("ready"/"gap") is computed from its evidence items (gap iff any item is flagged) both when the generator builds it and again when pack-format\'s Zod schema re-validates it. The caller cannot inject a readiness value that disagrees with the evidence.',
      },
      {
        title: "Byte-stable and signable",
        body: "The wall clock is injected only onto the outer envelope (generatedAt) and never enters the canonical body. Controls are id-sorted, evidence is collector-id-sorted, and the ZIP writer uses fixed 1980-epoch mtimes and a fixed deflate level, so identical evidence always canonicalizes and archives to the identical SHA-256, independent of who ran it or when.",
      },
      {
        title: "Bound to the audit chain, not a standalone claim",
        body: 'Every pack pins a chainAnchor {length, tipHash} from the WORM audit chain, and its posture copy is regex-checked to reject the words "compliant"/"certified", the bundle states control-evidence readiness only, never an audit opinion.',
      },
    ],
    faq: [
      {
        question: "What's in a Caisson audit evidence bundle?",
        answer:
          "A signed ZIP: a canonical manifest.json (controls, crosswalk citations, evidence, derived readiness), one JSON file per control under controls/, and a plain-text auditor-summary.txt, plus the WORM chain anchor the pack is bound to.",
      },
      {
        question:
          "Does generating an evidence bundle mean we're SOC 2 or HIPAA compliant?",
        answer:
          'No. The bundle ships the technical controls and evidence a framework\'s clauses require and states control-evidence readiness only, it is explicitly not an attestation or audit opinion, and the schema itself rejects any "compliant"/"certified" language in the output.',
      },
      {
        question: "What happens if evidence for a control is missing?",
        answer:
          "The generator refuses the entire bundle rather than shipping a partial one, flag-never-guess. It throws a structured BLOCKED report naming every control and collector still unresolved, so nothing gets handed to an auditor with a silent gap.",
      },
      {
        question:
          "Can the same evidence produce a different bundle each time it's generated?",
        answer:
          "No. Controls and evidence are sorted deterministically and the ZIP is built with fixed timestamps and compression settings, so identical underlying evidence always hashes to the same SHA-256, a property an auditor can independently re-verify.",
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
      "HIPAA technical safeguards are the five standards in 45 CFR §164.312 (access control (unique IDs, emergency access, auto-logoff, encryption), audit controls, integrity, authentication, and transmission security) protecting ePHI in information systems. Caisson's Compliance edition crosswalks every §164.312 citation to an own-authored canonical control, backing what it implements in code: fail-closed RLS, field encryption, the WORM audit log.",
    artifact: {
      label:
        "hipaaSecurity control pack: 164.312(b) audit controls crosswalked to the WORM audit log",
      lang: "ts",
      code: '{\n  id: "AUDIT.CONTROLS",\n  title: "Audit controls over ePHI systems",\n  family: "Technical Safeguards",\n  statement:\n    "Hardware, software, or procedural mechanisms record and examine activity in systems that " +\n    "contain or use ePHI, so that access and changes are attributable and reviewable.",\n  crosswalk: [\n    { framework: "HIPAA-Security", reference: "164.312(b)" },\n    {\n      framework: "SOC2-TSC",\n      reference: "CC7.2",\n      note: "Satisfied by the immutable audit log.",\n    },\n  ],\n},',
    },
    properties: [
      {
        title: "Own-authored, not ingested",
        body: "hipaa-security.ts is clean-room Caisson prose validated at module load, no NIST 800-66 or SCF (CC-BY-ND) text is copied or paraphrased. Crosswalk references carry only the bare CFR citation id (e.g. 164.312(b)), a factual pointer to the safeguard, never its regulatory text.",
      },
      {
        title: "One canonical control, many framework crosswalks",
        body: "Canonical control ids are framework-agnostic and shared across packs, AUDIT.CONTROLS crosswalks to both HIPAA 164.312(b) and SOC 2 CC7.2 in the same entry, so one control satisfies two frameworks' evidence requirements without duplicating logic.",
      },
      {
        title: "Flag-never-guess evidence",
        body: "A collector never infers a passing status it can't evidence: passResult requires a satisfied automated check, flaggedResult/unresolvedResult mandate a recorded reason, and unresolved evidence hard-blocks the pack, no partial pack ships silently.",
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
          "Five standards: Access Control (a) (with unique user ID (a)(2)(i), emergency access (a)(2)(ii), auto-logoff (a)(2)(iii), and encryption/decryption (a)(2)(iv) as its implementation specifications) plus Audit controls (b), Integrity (c), Person or entity authentication (d), and Transmission security (e). Caisson's hipaa-security.ts pack crosswalks every one of these CFR citations to an own-authored canonical control.",
      },
      {
        question: "Does Caisson make us HIPAA compliant?",
        answer:
          "No, no product makes an organization compliant; that's a determination your organization and its auditor make. Caisson ships the technical controls §164.312 requires (fail-closed tenancy RLS, per-tenant field encryption, an immutable audit log) and generates the evidence pack that documents them.",
      },
      {
        question: "How are HIPAA audit controls (164.312(b)) satisfied?",
        answer:
          "The AUDIT.CONTROLS canonical control crosswalks 164.312(b) to Caisson's WORM audit log, a hash-chained, append-only record where every access and change to ePHI is attributable and reviewable, with a chain-verify collector producing the evidence item at pack-generation time.",
      },
      {
        question:
          "Is the HIPAA control text copied from a third-party catalog?",
        answer:
          "No. Every statement and guidance string is clean-room, Caisson-authored prose (ADR-0057). Only the bare CFR citation identifiers (e.g. 164.312(a)(2)(i)) are used as crosswalk pointers, the regulation itself is public law, never NIST 800-66 or SCF text.",
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
      "Row-level security (RLS) is a Postgres feature that filters every query at the database layer so a session only sees rows a policy predicate admits, typically scoped to a tenant id. Caisson's tenancy-rls module makes it fail-closed: FORCE RLS plus a withTenant wrapper mean a query with no bound tenant context returns zero rows, never another tenant's data.",
    artifact: {
      label: "buildTenantPolicySql, FORCE RLS + tenant-column policy",
      lang: "ts",
      code: "export interface TenantPolicyOptions {\n  /** The tenant-key column. Default `account_id`. */\n  column?: string;\n  /** The role policies apply to (it must NOT be a superuser / BYPASSRLS). Default `app`. */\n  role?: string;\n}\n\n/**\n * SQL that makes `table` fail-closed tenant-isolated: ENABLE + **FORCE** RLS, GRANT CRUD to the\n * app role, and a policy that admits a row only when its tenant column equals the bound GUC.\n * Emitted into the table's migration (ADR-0014) so a tenant table can never ship without it.\n *\n * The GUC read is wrapped in `NULLIF(..., '')` (pgbouncer/pooler hardening): a pooled connection\n * that resets custom GUCs to `''` instead of fully unsetting them would otherwise compare\n * `column = ''`. `NULLIF` folds `''` to `NULL` first, so the comparison is always `NULL` (deny).\n */\nexport function buildTenantPolicySql(\n  table: string,\n  { column = \"account_id\", role = \"app\" }: TenantPolicyOptions = {},\n): string {\n  const guc = `NULLIF(current_setting('${TENANT_GUC}', true), '')`;\n  return [\n    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,\n    `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`,\n    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${role};`,\n    `CREATE POLICY ${table}_tenant_isolation ON ${table}`,\n    `  USING (${column} = ${guc})`,\n    `  WITH CHECK (${column} = ${guc});`,\n  ].join(\"\\n\");\n}",
    },
    properties: [
      {
        title: "FORCE closes the owner loophole",
        body: "Plain ENABLE ROW LEVEL SECURITY still lets the table owner bypass the policy. buildTenantPolicySql always emits FORCE ROW LEVEL SECURITY too, so the policy applies even to that connection, only a genuine superuser or BYPASSRLS role escapes it.",
      },
      {
        title: "withTenant is the sole entry point",
        body: "withTenant opens a transaction, binds the app.current_account GUC, then drops to the non-superuser app role before running the callback. A code path that forgets withTenant entirely never sets the GUC, so the policy predicate compares against null and the query returns nothing, fail-closed by construction.",
      },
      {
        title: "The role itself is verified, not assumed",
        body: "assertRoleNotPrivileged queries pg_roles once per (connection, role) and throws before ever SET LOCAL ROLE-ing into it if that role turns out to be SUPERUSER or BYPASSRLS, a misconfigured role can't silently reopen cross-tenant access with zero runtime signal.",
      },
      {
        title: "Admin writes get their own role, not a bypass",
        body: "The operator mutation surface runs as a separate admin_write role with its own USING(true) policy scoped TO admin_write only. RLS OR-combines permissive policies per role, so admin_write can see every tenant while app's isolation is untouched. That admin-write layer ships in the commercial @caisson/org-controls package; the free tenancy-rls package carries the buyer tenant-isolation floor itself.",
      },
    ],
    faq: [
      {
        question: "What is Postgres row-level security?",
        answer:
          "Row-level security is a native Postgres feature (since 9.5) that attaches a filter predicate to a table so every SELECT, UPDATE, and DELETE only touches rows the predicate admits, enforced inside the database engine itself, not in application code that can be skipped or gotten wrong.",
      },
      {
        question:
          "Does turning on RLS stop a forgotten tenant filter from leaking data?",
        answer:
          "Not by default, plain ENABLE ROW LEVEL SECURITY still lets the table owner bypass it. Caisson's tenancy-rls module adds FORCE ROW LEVEL SECURITY plus a privileged-role guard, so a query that never binds a tenant context matches nothing instead of returning every tenant's rows.",
      },
      {
        question: "How does multi-tenant RLS work in Caisson?",
        answer:
          "Every tenant table carries a policy comparing its account_id column to a Postgres GUC (app.current_account); withTenant is the only function that sets that GUC, inside a transaction, running as a role verified to be non-superuser, a path that skips withTenant has no GUC bound and reads zero rows.",
      },
      {
        question: "Does RLS alone make us SOC 2 or HIPAA compliant?",
        answer:
          "No, RLS ships the technical access control SOC2 CC6.x and HIPAA 164.312(a) require and generates the isolation proof as a test in the suite, but that control alone isn't compliance. The Compliance edition composes it with the audit chain, WORM evidence, and OSCAL mapping into the full evidence pack an audit needs.",
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
          "No. It ships the technical control SOC 2 CC6.1 requires for logical access control and generates the isolation proof as a test in the suite, but that control alone is not a compliance certification. The Compliance edition composes it with the audit chain and evidence pack an audit needs.",
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
          "No. The row-bound encryptField path (AAD binds tenant, key version, column, AND row id) ships the technical control HIPAA 164.312(a)(2)(iv) and SOC 2 CC6.1 expect for regulated columns and generates the evidence an auditor checks; the transparent encryptedColumn shown above stays on a 3-tuple AAD and is scoped to low-sensitivity fields. The certification itself still depends on your organization's administrative controls and the audit process, which Caisson does not perform for you.",
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
        body: "KmsClient exposes just three methods (generateDataKey, decryptDataKey, scheduleKeyDeletion). AWS KMS and GCP KMS drivers ship today (createAwsKmsClient, createGcpKmsClient, both live-tested); Azure Key Vault or Vault Transit would slot behind the same three-method port, but no driver for them ships yet. The field-crypto column and envelope format never know which backend is live.",
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
      "Crypto-shredding is cryptographic erasure: destroying a scope's encryption key so every ciphertext it protects becomes unrecoverable, the technical control GDPR and CCPA right-to-erasure requests point at, without deleting rows from an immutable audit chain. Caisson's field-crypto module schedules KEK deletion through a scope tied to one tenant, never a shared key, and mints an audit record carrying no PII.",
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
      "BYOK (bring your own key) lets a tenant supply its own AI provider API key instead of the shared lane, encrypted at rest under a per-tenant field-crypto envelope. Caisson's ai-kit resolves the key at inference time inside a tenant-scoped RLS transaction, debits zero credits only on allowlisted BYOK-covered actions, and never logs or persists the key in the clear.",
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
        body: "POST /api/byok requires session.role === \"owner\" (closing a bypass where any seat could rotate the org's shared key); reads stay seat-visible. resolveActionCost zeroes an inference action's credit cost only when that action is explicitly marked BYOK-covered; an unclassified action still meters, fail-metered by default.",
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
      code: 'export function verifyLicenseWithKey(\n  token: string | null | undefined,\n  publicKey: KeyObject,\n  now: Date = new Date(),\n): VerifiedLicense {\n  if (token === null || token === undefined || token === "") {\n    return COMMUNITY;\n  }\n  try {\n    const decoded = decodeToken(token);\n    const signedBytes = Buffer.from(decoded.payload, "utf8");\n\n    // Asymmetric verify over the EXACT signed bytes (Ed25519: algorithm = null). `crypto.verify`,\n    // not `timingSafeEqual`: a signature check is not a secret comparison (ADR-0010).\n    if (!cryptoVerify(null, signedBytes, publicKey, decoded.signature)) {\n      return COMMUNITY;\n    }\n\n    const parsed = licenseClaimsSchema.safeParse(\n      JSON.parse(decoded.payload) as unknown,\n    );\n    if (!parsed.success) {\n      return COMMUNITY;\n    }\n    const claims = parsed.data;\n\n    // ... format-conformance (canonicalize(claims) === decoded.payload) and expiry checks follow,\n    // each failing safe to COMMUNITY too ...\n\n    return {\n      valid: true,\n      tier: claims.tier,\n      entitlements: claims.entitlements,\n      eval: claims.eval === true, // the eval-license discriminator (watermarking, no-redistribution)\n      claims,\n    };\n  } catch {\n    // Any unexpected throw (JSON parse, codec edge, crypto) → community. The verifier never raises.\n    return COMMUNITY;\n  }\n}',
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
      code: 'export function makeLicenseEntitlementResolver(\n  getDenied: () => ReadonlySet<string>,\n  verify: (token: string) => VerifiedLicense = verifyLicense,\n): (request: Request) => ResolvedLicense | null {\n  return (request: Request): ResolvedLicense | null => {\n    const header = request.headers.get("authorization");\n    if (header === null) return null;\n    const match = BEARER_RE.exec(header.trim());\n    const token = match?.[1];\n    if (token === undefined) return null;\n    const verified = verify(token);\n    if (!verified.valid || verified.claims === null) return null;\n    // Edge revocation gate: an operator-revoked license id resolves to community, base-only.\n    if (getDenied().has(verified.claims.licenseId)) return null;\n    // The signed per-entitlement updates windows + entitledSince snapshots ride along; an\n    // absent/null claim normalizes to the empty map (every entitlement unbounded / grandfathered).\n    return {\n      entitlements: verified.entitlements,\n      updatesWindows: verified.claims.updatesWindows ?? {},\n      entitledSince: verified.claims.entitledSince ?? {},\n    };\n  };\n}',
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
      code: "export async function debit(\n  tx: TenantExecutor,\n  input: DebitInput,\n): Promise<CreditResult> {\n  assertPositiveInt(input.amount);\n  // ... elided: idempotency + feature-tag resolution, the per-account SELECT ... FOR UPDATE\n  // wallet row lock, and the FIFO walk over unexpired grants (unexpiredGrantsFifo +\n  // insertConsumption) that throws InsufficientCreditsError when grants cannot cover the debit ...\n  const fresh = await insertEvent(tx, {\n    accountId: input.accountId,\n    eventType: input.eventType,\n    amount: -input.amount,\n    // ...\n  });\n  if (!fresh) return { balance: await balance(tx, input.accountId), idempotent: true };\n  const updated = await tx.query<{ balance: number }>(\n    `UPDATE credit_wallet SET balance = balance - $2\n     WHERE account_id = $1 AND balance >= $2\n     RETURNING balance`,\n    [input.accountId, input.amount],\n  );\n  if (updated.rows.length === 0) {\n    // Insufficient: rolls back the transaction, a failed debit leaves no trace (ADR-0007).\n    throw new InsufficientCreditsError(input.amount, await balance(tx, input.accountId));\n  }\n  return { balance: updated.rows[0]?.balance ?? 0, idempotent: false };\n}",
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
        body: "resolveGate() runs the same baseModuleIds() union expandEntitlements() computation the read-only index route already runs; the npm surface doesn't reimplement license checking, it calls the injected resolveEntitlements against the same offline-Ed25519 verify.",
      },
      {
        title: "No-existence-leak gating",
        body: "gateStatus() returns 401 (retry with a token) when the request carries no Authorization header, and 404 (indistinguishable from an unknown package) when it does and still isn't entitled, so a probe can never learn whether an unpurchased module even exists (the D3 no-existence-leak lock, ADR-0223).",
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
      code: '  hybridSearch(opts: HybridSearchOptions): SearchHit[] {\n    const limit = opts.limit ?? 10;\n    const legLimit = Math.max(limit * 8, 50);\n    const ftsWeight = opts.ftsWeight ?? 1;\n    if (!Number.isFinite(ftsWeight) || ftsWeight <= 0) {\n      throw new ValidationError("ftsWeight must be a positive finite number", {\n        received: ftsWeight,\n      });\n    }\n\n    const vecRanks = this.vecLeg(opts.queryVector, legLimit);\n    const ftsRanks = this.ftsLeg(opts.queryText, legLimit);\n\n    // RRF fusion: every leg a doc appears in contributes 1/(RRF_K + rank); sum across legs. The\n    // FTS contribution is scaled by `ftsWeight` (default 1 — the symmetric classic form).\n    const fused = new Map<number, number>();\n    for (const [rowid, rank] of vecRanks)\n      fused.set(rowid, (fused.get(rowid) ?? 0) + 1 / (RRF_K + rank));\n    for (const [rowid, rank] of ftsRanks)\n      fused.set(rowid, (fused.get(rowid) ?? 0) + ftsWeight / (RRF_K + rank));\n\n    const ranked = [...fused.entries()]\n      // score descending; deterministic tie-break by rowid ascending (stable, env-free).\n      .sort((a, b) => b[1] - a[1] || a[0] - b[0])\n      .slice(0, limit);\n    if (ranked.length === 0) return [];\n\n    return ranked.map(([rowid, score]) => ({ id: this.docId(rowid), score }));\n  }',
    },
    properties: [
      {
        title: "FTS5 is the always-available floor",
        body: "hybridSearch always runs the FTS5 leg; the vector leg runs only when a queryVector is supplied, and a vec backend fault is caught and skipped rather than thrown. No embedder configured, no live vector index, no server down: retrieval degrades to FTS5-only and keeps answering.",
      },
      {
        title: "One fixed formula, not a tunable blend",
        body: "Fusion is Reciprocal Rank Fusion at the standard RRF_K=60: every leg a document appears in contributes 1/(60+rank), summed across legs, then ranked descending with a deterministic rowid tie-break. One lever exists, ftsWeight (default 1, the symmetric classic form) scales the FTS leg when exact-term evidence should outrank semantic neighborhood; a non-positive value throws rather than guesses. Ordering never depends on the environment.",
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
          "By Reciprocal Rank Fusion. Each leg's rank contributes 1/(RRF_K + rank), with RRF_K=60, summed per document across whichever legs ran; the single tuning lever is ftsWeight, which scales the FTS leg's contribution (default 1). The formula is deterministic, identical inputs and weight always produce the identical fused ranking.",
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
        body: "The checkRateLimit hook is awaited before any tool handler runs, for both base and edition tools. A genuine over-limit throws a 429, but a rate-limit store fault fails open (resolves and alerts) so an infrastructure blip never locks out a paying buyer.",
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
  // ---- AEO long-tail explainers (CAISSON-29 / D5) — use-case/how-to angles distinct from the
  // definitional terms above (worm-audit-log · oscal · row-level-security). Each cites a REAL,
  // different package entry point and cross-links to its definitional sibling, so the pair reads as
  // a topic cluster, not two thin near-duplicates. ----
  {
    slug: "worm-audit-logs-for-saas",
    term: "WORM audit logs for SaaS",
    cluster: "compliance",
    definition:
      "WORM audit logs for a SaaS are tamper-evident activity records your application appends but can never rewrite, enforced by storage, not app convention. Caisson's @caisson/audit-worm gives each tenant a hash-chained log and mints a write-once S3 Object-Lock anchor on every append, so a single call from a request handler records the event and its integrity proof together.",
    artifact: {
      label:
        "AuditChainStore: one append() call records the event AND mints its WORM anchor, tenant-scoped",
      lang: "ts",
      code: '// One store per process; each request appends under the caller\'s tenant id.\nconst audit = new AuditChainStore({ db, store: s3WormStore });\n\n// In a request handler — one call records the event AND mints a fresh WORM anchor,\n// both inside the same tenant-scoped transaction (never a separate anchoring job).\nconst { entry, anchor } = await audit.append(accountId, {\n  action: "invoice.exported",\n  actor: session.userId,\n  target: invoiceId,\n});\n// A truncate-then-replay for entry.seq collides on the write-once anchor key -> ConflictError.',
    },
    properties: [
      {
        title: "One call, two independent guarantees",
        body: "append() writes the chain entry and mints the length-keyed WORM anchor over the result before it returns, in the same transaction. You never run a separate nightly anchoring job that could be skipped, and the DB grant (no UPDATE/DELETE) and the write-once object are two controls, so neither has to hold alone.",
      },
      {
        title: "Tenant-scoped by construction",
        body: "Every append runs inside withTenant behind a per-tenant advisory lock, so a forgotten tenant filter can't cross-write another tenant's chain and two concurrent appends can't fork the chain at the same length.",
      },
      {
        title: "Real WORM storage, not a boolean",
        body: "The store is an S3 Object-Lock bucket (a local write-once store in dev); the anchor lands via a conditional write-once PUT, so a truncate-then-replay hits the existing immutable object and throws ConflictError instead of silently overwriting the tip.",
      },
      {
        title: "A six-year retention floor by default",
        body: "Each anchor carries a retain-until date computed from the audit-worm retention default (seven years, above the six-year floor HIPAA §164.316(b)(2) and SEC 17a-4 set), and retention only ever extends, evidence can't be disposed early.",
      },
    ],
    faq: [
      {
        question: "How do I add a tamper-evident audit log to my SaaS?",
        answer:
          "Construct an AuditChainStore with your Postgres transactor and a WORM object store, then call append(accountId, event) from each request handler you want on the record. That one call hash-chains the entry and writes a write-once anchor to WORM storage, so both the log and its integrity proof land together, no separate service or nightly job.",
      },
      {
        question:
          "Do I need a blockchain or a third-party service for WORM audit logging?",
        answer:
          "No. Caisson's audit-worm runs on your own Postgres plus an S3 Object-Lock bucket you already control. The chain is a SHA-256 hash chain; the immutability comes from the database withholding UPDATE/DELETE and S3 refusing to overwrite a write-once key, no external ledger and no vendor in the trust path.",
      },
      {
        question:
          "Does a WORM audit log make my SaaS SOC 2 or HIPAA compliant?",
        answer:
          "No, it ships the technical control SOC 2 CC7.2 and HIPAA 164.312(b) check for (a tamper-evident, immutable record of activity) and generates the evidence an auditor examines. Compliance is your assessor's conclusion across people, process, and technology; the log is one input to it, never a certification.",
      },
      {
        question: "Where do the audit entries actually live?",
        answer:
          "The entries are rows in an append-only audit_chain_entry table (the app role holds SELECT + INSERT only, never UPDATE/DELETE), and each append also writes a small length-keyed anchor object ({length, tipHash, genesisHash}) to your WORM bucket. Reads verify the DB chain against that trusted anchor.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel: "See how the Compliance bundle ships WORM audit logging",
      ctaHref: "/compliance",
    },
    related: ["worm-audit-log", "s3-object-lock", "soc2-audit-log"],
  },
  {
    slug: "oscal-export-typescript",
    term: "OSCAL export from a TypeScript stack",
    cluster: "compliance",
    definition:
      "OSCAL export from a TypeScript stack means generating NIST's machine-readable assessment documents (Security Assessment Results, POA&M, and Assessment Plan) directly from your Node codebase, no Java re-keying. Caisson's Compliance bundle authors OSCAL v1.2.2 JSON from a signed evidence-pack manifest with assembleOscalEvidenceBundle, deterministic given a pinned clock and id seam, and emits an XML sibling through NIST's own oscal-cli.",
    artifact: {
      label:
        "assembleOscalEvidenceBundle: manifest -> signed AP + SAR + POA&M as a path->bytes map",
      lang: "ts",
      code: "// From an evidence-pack manifest — authors the OSCAL Assessment Plan, SAR, and POA&M,\n// then signs the manifest. Pin the `now` + `newId` seams for byte-identical output.\nconst bundle = await assembleOscalEvidenceBundle(manifest, signer, {\n  now: runAt,\n  newId: seededUuid,\n});\n\n// bundle.files is a { relativePath -> canonical UTF-8 bytes } map — write it straight out:\n//   ./assessment-plan/soc2.json  ./sar.json  ./poam.json  ./manifest.json  ./manifest.sig\nfor (const [path, bytes] of Object.entries(bundle.files)) {\n  await writeFile(join(outDir, path), bytes);\n}",
    },
    properties: [
      {
        title: "Native TypeScript/JSON, no Java re-key",
        body: "The Assessment Plan, SAR, and POA&M are authored in TypeScript against the NIST OSCAL v1.2.2 schema; JSON is the canonical, byte-stable output your Node build emits directly, so a GRC tool or FedRAMP reviewer ingests it without a human re-keying a PDF.",
      },
      {
        title: "Deterministic given a pinned seam",
        body: "The wall-clock now and the UUID source newId are injected; pin them and the same evidence pack canonicalizes to byte-identical OSCAL every run, so the export is safe to diff and re-verify in CI, not a fresh blob each time.",
      },
      {
        title: "Satisfied/not-satisfied is derived, gaps recorded not guessed",
        body: "Each control's OSCAL finding maps from the evidence pack's own readiness (a not-satisfied finding's remarks is the flagged evidence's recorded reason (gapReason), never an inferred explanation) and a clean pack ships the single truthful no-open-items POA&M entry the schema requires.",
      },
      {
        title: "An XML sibling from NIST's own converter",
        body: "When XML is required, it's produced by shelling out to NIST's oscal-cli converter, never a hand-rolled serializer, so the XML validates against the same conformance target (v1.2.2) the JSON does.",
      },
    ],
    faq: [
      {
        question: "Can I generate OSCAL from a Node or TypeScript codebase?",
        answer:
          "Yes. Caisson's Compliance bundle authors OSCAL v1.2.2 documents in TypeScript and emits canonical JSON straight from your build, assembleOscalEvidenceBundle turns a signed evidence-pack manifest into the Assessment Plan, SAR, and POA&M as a path-to-bytes map you write to disk or a bucket. No Java toolchain and no manual re-keying.",
      },
      {
        question: "What OSCAL version does the export target?",
        answer:
          "OSCAL v1.2.2, the single oscal-cli validate conformance target. JSON is the canonical, byte-stable output; the optional XML sibling is produced by shelling out to NIST's own oscal-cli converter so both validate against the same version.",
      },
      {
        question: "Does exporting OSCAL mean I'm FedRAMP or SOC 2 authorized?",
        answer:
          "No. The OSCAL bundle is the evidence assessment and gap register (satisfied/not-satisfied per control, POA&M items for any gap) in the format FedRAMP and GRC tools expect. It ships the technical readiness picture the framework requires; the authorization decision is your assessor's, not the export's.",
      },
      {
        question: "Is the OSCAL output stable enough to diff in CI?",
        answer:
          "Yes, once you pin the injected now and newId seams. The documents are id-sorted and canonicalized, so identical evidence produces byte-identical OSCAL, a property CI can re-verify and a reviewer can independently reproduce, rather than a fresh non-deterministic blob per run.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel: "See how the Compliance bundle ships OSCAL evidence export",
      ctaHref: "/compliance",
    },
    related: ["oscal", "audit-evidence-bundle", "control-to-code-mapping"],
  },
  {
    slug: "multi-tenant-rls-compliance",
    term: "Multi-tenant RLS for compliance",
    cluster: "security",
    definition:
      "Multi-tenant RLS for compliance is enforcing tenant isolation inside Postgres itself (a row-level-security policy the database applies to every query) so a forgotten WHERE clause can't leak another tenant's data. Caisson's @caisson/tenancy-rls makes it fail-closed: FORCE row-level security plus a withTenant wrapper mean an unscoped query returns zero rows, and the isolation ships as a test.",
    artifact: {
      label:
        "withTenant: the sole entry point: bind the tenant GUC, drop to the non-superuser app role, fail closed",
      lang: "ts",
      code: '// The sole entry point for a tenant query. Skip it and the policy predicate sees no bound\n// tenant -> zero rows returned, never another tenant\'s data (fail-closed by construction).\nexport async function withTenant<T>(\n  db: Transactor,\n  accountId: string,\n  fn: (tx: TenantExecutor) => Promise<T>,\n): Promise<T> {\n  if (accountId.length === 0) {\n    throw new TenancyError("Refusing to run a tenant query without an account id");\n  }\n  return db.transaction(async (tx) => {\n    await tx.query(`SELECT set_config($1, $2, true)`, [TENANT_GUC, accountId]);\n    await ensureRoleGuard(db, tx, "app"); // refuses a SUPERUSER / BYPASSRLS role\n    await tx.exec(`SET LOCAL ROLE app`);\n    return fn(tx);\n  });\n}',
    },
    properties: [
      {
        title: "FORCE RLS, not just ENABLE",
        body: "Plain ENABLE ROW LEVEL SECURITY still lets the table owner bypass the policy. buildTenantPolicySql always emits FORCE ROW LEVEL SECURITY too, so the isolation applies even to the owning connection, only a genuine superuser or BYPASSRLS role escapes it.",
      },
      {
        title: "withTenant is the sole entry point",
        body: "withTenant binds the tenant GUC, verifies then drops to the non-superuser app role, and runs your callback. A code path that forgets it never sets the GUC, so the policy predicate compares against null and the query returns nothing, a leak becomes zero rows, not another tenant's data.",
      },
      {
        title: "The role is verified, not assumed",
        body: "ensureRoleGuard queries pg_roles once per connection and throws before SET ROLE if the app role turns out to be SUPERUSER or BYPASSRLS, a misconfigured role can't silently reopen cross-tenant access with no runtime signal.",
      },
      {
        title: "The control is also the evidence",
        body: "A cross-tenant read returning zero rows is an assertion in the test suite that runs every build, and the RLS-force evidence collector turns that live check into a pass/flag input for the SOC 2 CC6.x / HIPAA 164.312(a) evidence pack, the isolation proves itself.",
      },
    ],
    faq: [
      {
        question: "How do I isolate tenants for SOC 2 or HIPAA in Postgres?",
        answer:
          "Put the isolation in the database, not just the app: give every tenant table a row-level-security policy comparing its account_id to a session GUC, add FORCE ROW LEVEL SECURITY so even the table owner is bound, and route every query through a wrapper that sets the GUC and drops to a non-superuser role. Caisson's tenancy-rls ships exactly this, fail-closed.",
      },
      {
        question:
          "Is application-level tenant filtering enough for a compliance audit?",
        answer:
          "It's the control most likely to fail: one forgotten WHERE clause leaks every tenant's rows, and there's no engine-level backstop. Row-level security moves the predicate into Postgres so it applies to every SELECT, UPDATE, and DELETE regardless of the query, an auditor can see the isolation is enforced by the database, not by hoping every query got it right.",
      },
      {
        question: "Does RLS alone make me SOC 2 or HIPAA compliant?",
        answer:
          "No. RLS ships the technical access control SOC 2 CC6.x and HIPAA 164.312(a) require and generates the isolation proof as a test, but that one control isn't compliance. The Compliance bundle composes it with the audit chain, WORM evidence, and OSCAL mapping into the full evidence pack an audit needs.",
      },
      {
        question: "What happens if my connection pooler resets the tenant GUC?",
        answer:
          "The policy read is wrapped in NULLIF(current_setting(...), '') so a pooled connection that resets the custom GUC to an empty string is treated as no tenant bound, the predicate matches nothing and the query returns zero rows. A pooler quirk degrades to fail-closed, never to a cross-tenant read.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel: "See how the Compliance bundle turns RLS into audit evidence",
      ctaHref: "/compliance",
    },
    related: ["row-level-security", "multi-tenant-isolation", "fail-closed"],
  },
  {
    slug: "eu-ai-act-article-50",
    term: "EU AI Act Article 50",
    cluster: "compliance",
    definition:
      "EU AI Act Article 50 is the regulation's transparency chapter, enforceable from August 2, 2026: AI systems interacting with people must disclose it, and generated content must carry machine-readable marking, regardless of risk class. The obligation is disclosure-shaped; proving you met it needs a tamper-evident record that disclosure actually fired.",
    artifact: {
      label:
        "Record the Article 50 disclosure as a tamper-evident audit event, a verifiable answer to “did disclosure fire for this session?”",
      lang: "ts",
      code: '// The disclosure surface is your UI; the RECORD that it fired is audit-chain evidence.\n// append() canonicalizes the payload, hash-chains it onto the tenant\'s tip, and mints a\n// write-once WORM anchor in the same call — so the disclosure log can\'t be quietly edited.\nawait chainStore.append(accountId, {\n  event: "ai.disclosure.shown",\n  clause: "eu-ai-act/art-50-1",\n  surface: "support-chat",\n  sessionId,\n  disclosureVersion: "2026-07-10", // the versioned copy shown to the user\n});\n\n// Later — for the evidence bundle, or a regulator\'s question:\nconst result = await chainStore.verify(accountId);\n// → { valid: true, brokenAt: null } — a non-null brokenAt surfaces tamper, insert, reorder,\n// or truncation.',
    },
    properties: [
      {
        title: "It applies to ordinary products, not just high-risk systems",
        body: "Unlike the Annex III high-risk regime, Article 50 covers any AI system that interacts directly with people, a SaaS chatbot, a support agent, a content generator. From August 2, 2026 (a date confirmed unmoved by the Digital Omnibus amendment, per reporting through 2026-07-07), the disclosure obligations are enforceable law.",
      },
      {
        title: "The obligation is disclosure; the audit question is proof",
        body: "A regulator or enterprise customer asking whether users knew they were talking to AI is asking for a record, not a recollection. Logging each disclosure event to a hash-chained, WORM-anchored audit trail turns the answer into something independently verifiable.",
      },
      {
        title: "Marking happens at the generation boundary",
        body: "Article 50(2) requires machine-readable marking of synthetic audio, image, video, and text. Applying the marking where content is generated (and versioning that configuration in the repo) keeps the control testable in CI instead of a per-feature afterthought.",
      },
    ],
    faq: [
      {
        question: "Does Article 50 apply to my SaaS chatbot?",
        answer:
          "If the chatbot interacts directly with people, yes, regardless of whether your system is high-risk. Users must be informed they are interacting with AI unless that is obvious from context to a reasonably well-informed person (Art. 50(1)). Generated-content marking (Art. 50(2)) applies separately if you produce synthetic content.",
      },
      {
        question: "When does Article 50 become enforceable?",
        answer:
          "August 2, 2026, the AI Act's general application date. Independent reporting through 2026-07-07 confirmed it was not extended by the Digital Omnibus amendment. Penalties for transparency violations reach €15M or 3% of worldwide annual turnover, whichever is higher (Art. 99(4)).",
      },
      {
        question: "Does Caisson make my product Article 50 compliant?",
        answer:
          "No, the disclosure UI is your product surface and the legal determination is yours. Caisson ships the evidence discipline behind the obligation: disclosure events recorded to a tamper-evident, WORM-anchored audit chain and packaged into dated evidence bundles, so the record of disclosure is verifiable rather than asserted.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel: "What Article 50 requires, and the record that proves it",
      ctaHref: "/frameworks/eu-ai-act/article-50",
    },
    related: ["worm-audit-log", "hash-chain-audit-trail", "compliance-as-code"],
  },
  {
    slug: "rfc-3161-timestamping",
    term: "RFC 3161 timestamping",
    cluster: "compliance",
    definition:
      "RFC 3161 timestamping is an IETF-standard protocol where a trusted third-party authority (TSA) cryptographically attests that a piece of data existed at a specific time, without seeing the data itself, only its hash. Caisson's audit-worm package submits each periodic audit-chain anchor's hash to a TSA and stores the signed token as a private, verifiable receipt.",
    artifact: {
      label:
        "TsaAnchorLog.submit: DER-encode a TimeStampReq over the anchor's hash, POST it, verify the response attests the exact imprint",
      lang: "ts",
      code: 'export class TsaAnchorLog implements TrustedTimestampLog {\n  async submit(anchorBytes: Uint8Array): Promise<TimestampReceipt> {\n    const imprint = createHash("sha256").update(anchorBytes).digest();\n    const reqBer = buildTimeStampReqBer(imprint, this.#reqPolicy);\n    const resp = await fetchWithTimeout(\n      this.#url,\n      {\n        method: "POST",\n        headers: {\n          "content-type": "application/timestamp-query",\n          accept: "application/timestamp-reply",\n        },\n        body: reqBer,\n      },\n      { timeoutMs: this.#timeoutMs },\n    );\n    if (!resp.ok) {\n      throw new ValidationError("TSA request failed", { status: resp.status });\n    }\n    const respDer = new Uint8Array(await resp.arrayBuffer());\n    return parseTimeStampResp(respDer, imprint, this.#url);\n  }\n}\n\n// Build the DER TimeStampReq (RFC-3161): version 1, sha256 imprint, certReq, random nonce.\nfunction buildTimeStampReqBer(\n  imprint: Uint8Array,\n  reqPolicy: string | undefined,\n): ArrayBuffer {\n  const messageImprint = new MessageImprint({\n    hashAlgorithm: new AlgorithmIdentifier({\n      algorithmId: SHA256_OID,\n      algorithmParams: new Null(),\n    }),\n    hashedMessage: new OctetString({ valueHex: imprint }),\n  });\n  const req = new TimeStampReq({\n    version: 1,\n    messageImprint,\n    certReq: true,\n    nonce: new Integer({ valueHex: randomBytes(16) }),\n    ...(reqPolicy !== undefined ? { reqPolicy } : {}),\n  });\n  return req.toSchema().toBER();\n}',
    },
    properties: [
      {
        title: "Imprint-only egress, never the data",
        body: "submit() sends fetchWithTimeout only a DER TimeStampReq whose messageImprint is sha256(anchorBytes), the anchor is already just {length, tipHash, genesisHash}, so the TSA never sees payload or PII, only a hash of a hash.",
      },
      {
        title: "The response is checked, not just trusted",
        body: "parseTimeStampResp requires a granted PKIStatus, walks the CMS SignedData to the signed TSTInfo, and constant-time compares (safeEqualFixed) the TSA's attested messageImprint against the one submitted, a TSA that signs the wrong imprint fails the receipt outright rather than being recorded as valid.",
      },
      {
        title: "A private receipt, not a public one",
        body: "This is v1's only grade, trusted-timestamped: the token proves timing to whoever holds the tenant's own WORM store. Caisson never markets a TSA receipt as externally verifiable, that stronger claim (externally-transparent) is reserved for the separate public-log target (Rekor/OTS), which a TSA receipt can never silently become.",
      },
      {
        title: "Full CMS verification on read-back, not a structural parse",
        body: "verifyExternal's TSA path re-parses the stored token as CMS DER, verifies the SignedData signature over TSTInfo, confirms the signing cert carries the id-kp-timeStamping EKU, and (when the deployment configured trust anchors) validates the certificate chain, surfacing chainValidated: false rather than upgrading the claim when no root was configured.",
      },
    ],
    faq: [
      {
        question: "What is RFC 3161 timestamping?",
        answer:
          "It's an IETF protocol (RFC 3161) for getting a signed proof from a timestamping authority (TSA) that a hash existed at a given time, without exposing the underlying data. Caisson uses it to timestamp audit-chain anchors, so a stored anchor carries independent, third-party proof of when it was sealed.",
      },
      {
        question:
          "Does an RFC 3161 timestamp prove to an outside party that our records weren't rewritten?",
        answer:
          "Not on its own. A TSA receipt is stored back in the buyer's own WORM store, so it's trusted-timestamped, not externally-transparent, a receipt that lives in the trust domain it's supposed to check can't prove anything to someone who doesn't trust that domain. Caisson's public-log grade (Rekor/OpenTimestamps) is the separate, stricter tier for that claim, and the two are never conflated in code or copy.",
      },
      {
        question:
          "Does RFC 3161 timestamping make our audit trail SOC 2 or HIPAA compliant?",
        answer:
          "No. It ships a technical control (independently-attested, tamper-evident timing evidence over your audit chain) and generates the receipt an auditor can examine; it doesn't itself constitute a compliance certification, and the org controls and audit engagement remain yours.",
      },
      {
        question: "Which timestamping authority does Caisson use?",
        answer:
          "None hardcoded, TsaAnchorLog takes the TSA url as deployment config (any RFC 3161-compliant authority, public or private), never a module constant, so a buyer can point it at their own TSA.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel:
        "See how the Compliance edition ships RFC 3161 external anchoring",
      ctaHref: "/compliance",
    },
    related: ["worm-audit-log", "audit-evidence-bundle"],
  },
  {
    slug: "transparency-log",
    term: "Transparency log",
    cluster: "compliance",
    definition:
      "A transparency log is a public, append-only Merkle-tree ledger (the Certificate-Transparency model formalized in RFC-6962) where a signed checkpoint plus an inclusion proof lets anyone verify an entry landed, without trusting the log's operator. Caisson's audit-worm package submits each audit-chain anchor to Sigstore's Rekor v2 log over ed25519ph, then verifies the resulting receipt fully offline against the embedded checkpoint key.",
    artifact: {
      label:
        "verifyRekorReceipt: fail-closed, fully offline: checkpoint signature + RFC-6962 inclusion proof + leaf-digest binding, zero network",
      lang: "ts",
      code: 'export function verifyRekorReceipt(\n  receipt: TransparencyReceipt,\n  anchorBytes: Uint8Array,\n): RekorVerifyResult {\n  // ...embedded log key parsed from receipt.logPublicKey (DER SPKI)...\n\n  const cp = parseCheckpoint(receipt.checkpoint);\n  if (cp === null) return fail("checkpoint envelope is malformed");\n  if (cp.origin !== receipt.origin) {\n    return fail("checkpoint origin does not match the receipt origin");\n  }\n\n  // (1) find the log\'s own signature line (keyHash-bound) and verify it.\n  const expectKeyHash = sha256(\n    new TextEncoder().encode(cp.origin),\n    Uint8Array.of(0x0a, 0x01),\n    rawLogPub,\n  ).subarray(0, 4);\n  const ownSig = cp.sigLines.find(\n    (s) =>\n      s.name === cp.origin &&\n      s.blob.length === 68 &&\n      bytesEqual(s.blob.subarray(0, 4), expectKeyHash),\n  );\n  if (ownSig === undefined) return fail("no matching log checkpoint signature");\n  if (!edVerify(null, cp.signedText, logKey, ownSig.blob.subarray(4))) {\n    return fail("checkpoint signature did not verify");\n  }\n\n  // (2) RFC-6962 inclusion proof against the VERIFIED checkpoint root + tree size.\n  const leafHash = sha256(Uint8Array.of(LEAF_PREFIX), leaf);\n  if (!verifyInclusion(BigInt(receipt.logIndex), cp.treeSize, leafHash, proof, cp.rootHash)) {\n    return fail("inclusion proof does not reconstruct the checkpoint root");\n  }\n\n  // (3) leaf digest must equal SHA-512(anchorBytes) under SHA2_512 — binds THIS receipt to THIS anchor.\n  const leafData = leafBodySchema.parse(\n    JSON.parse(new TextDecoder().decode(leaf)),\n  ).spec.hashedRekordV002.data;\n  if (leafData.algorithm !== "SHA2_512") {\n    return fail("leaf digest algorithm is not SHA2_512");\n  }\n  const expectedDigestB64 = createHash("sha512").update(anchorBytes).digest("base64");\n  if (!safeEqualFixed(leafData.digest, expectedDigestB64)) {\n    return fail("leaf digest does not match SHA-512 of the current anchor bytes");\n  }\n\n  return { ok: true, logIndex: receipt.logIndex };\n}',
    },
    properties: [
      {
        title: "Two independent proofs compose, both required",
        body: "verifyRekorReceipt fails closed unless BOTH hold: the log's checkpoint signature verifies against the receipt-embedded Ed25519 key (the log attests a root), and an RFC-6962 inclusion proof reconstructs that exact root from the leaf (the entry is under that root). Either check alone would be forgeable; together they aren't.",
      },
      {
        title: "The receipt is self-contained, it outlives its shard",
        body: "Rekor shards retire roughly every six months and v2 dropped online proof retrieval, but WORM receipts are retained for years. So the receipt snapshots the checkpoint-signing key and origin at submit time and verifies with zero network and no TUF freshness check, a years-old receipt against a since-retired shard still verifies.",
      },
      {
        title: "Never a hardcoded shard, never a non-ed25519ph signer",
        body: "resolveWriteUrl reads the write URL from a deployment-supplied SigningConfig and asserts https at call time; RekorAnchorLog's constructor throws if the injected signer's algorithm isn't exactly \"ed25519ph\" (hashedrekord rejects plain Ed25519). Both are runtime refusals, not documentation.",
      },
      {
        title: "Public egress requires an explicit, unforgeable opt-in",
        body: "RekorAnchorLog's constructor throws unless it receives a branded IrreversiblePublicityOptIn, which only irreversiblePublicityOptIn() can mint, and only by echoing the exact PUBLICITY_ACKNOWLEDGEMENT string. A public-log submission can't happen by default or by accident.",
      },
    ],
    faq: [
      {
        question: "What is a transparency log?",
        answer:
          "A transparency log is a public, append-only Merkle-tree ledger where every entry carries a cryptographic inclusion proof against a periodically signed checkpoint (tree head), the model Certificate Transparency formalized in RFC-6962. Caisson's audit-worm package submits each audit-chain anchor to Sigstore's Rekor v2 log this way, so the log operator itself can't quietly drop or rewrite an entry.",
      },
      {
        question:
          "How is anchoring to Rekor different from Caisson's WORM audit log?",
        answer:
          "The WORM audit log's tamper-evidence lives in the buyer's own trust domain, a hash chain plus a write-once object store only the buyer's deployment controls. Rekor anchoring composes a third, independent leg: the chain's periodic anchor is also committed to a public log outside Caisson's or the buyer's control, so compromising both the DB and the WORM store still can't rewrite history without also forging a public checkpoint.",
      },
      {
        question:
          "Does public transparency-log anchoring make Caisson SOC 2 or HIPAA compliant?",
        answer:
          "No. It ships the technical control auditors examine (a publicly, independently verifiable timestamp and inclusion proof for the audit chain's integrity) and generates evidence for the audit; it doesn't itself constitute a compliance certification.",
      },
      {
        question: "Is any tenant data exposed by anchoring to a public log?",
        answer:
          "No payload or PII leaves the deployment. The submission carries the anchor's SHA-512 digest, a detached signature, and the public key, never the audited records themselves, and the anchor bytes are hashes only. But submission is irreversible and the entry's existence, timing, and rough volume become publicly visible, which is why Caisson requires an explicit, typed opt-in acknowledgement before RekorAnchorLog will even construct.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel:
        "See how the Compliance edition ships public transparency-log anchoring",
      ctaHref: "/compliance",
    },
    related: [
      "worm-audit-log",
      "hash-chain-audit-trail",
      "audit-evidence-bundle",
      "s3-object-lock",
    ],
  },
  {
    slug: "evidence-receipt",
    term: "Evidence receipt",
    cluster: "compliance",
    definition:
      "An evidence receipt is a versioned proof bundle for one audit-log entry, raw material a verifier recomputes, never a verdict it's asked to trust. Caisson's kernel builds one per row from the entry's hash-chain link and its per-length WORM anchor behind the admin proof endpoint, classifying the row into one of six fail-closed verification states.",
    artifact: {
      label:
        "buildRowReceipt: a versioned proof bundle carrying raw material, not a trusted verdict",
      lang: "ts",
      code: "export function buildRowReceipt(input: {\n  entry: AuditChainEntry;\n  anchorForRow: AuditChainAnchor;\n  redacted: boolean;\n  checks: VerifyLegs;\n  verifiedAt: string;\n  includeAnchorProvenance?: boolean;\n}): RowReceipt {\n  const { entry, anchorForRow, redacted, checks, verifiedAt, includeAnchorProvenance } = input;\n  const anchor: {\n    length: number;\n    tipHash: string;\n    genesisHash?: string;\n    sig?: string;\n    keyId?: string;\n  } = { length: anchorForRow.length, tipHash: anchorForRow.tipHash };\n  if (includeAnchorProvenance === true) {\n    if (anchorForRow.genesisHash !== undefined) anchor.genesisHash = anchorForRow.genesisHash;\n    if (anchorForRow.sig !== undefined) anchor.sig = anchorForRow.sig;\n    if (anchorForRow.keyId !== undefined) anchor.keyId = anchorForRow.keyId;\n  }\n  return {\n    v: ROW_RECEIPT_VERSION,\n    seq: entry.seq,\n    hash: entry.hash,\n    prevHash: entry.prevHash,\n    anchor,\n    raw: { prevHash: entry.prevHash, payload: entry.payload },\n    redacted,\n    checks,\n    verifiedAt,\n  };\n}",
    },
    properties: [
      {
        title: "Raw material, not a verdict",
        body: "The receipt's checks and verifiedAt fields are derived, untrusted display material, a standalone verifier ignores them and recomputes both legs itself from raw.prevHash and raw.payload, the only fields it actually trusts.",
      },
      {
        title: "Six fail-closed states, never a false 'verified'",
        body: "classifyRowState maps the recompute legs to one of verified, anchor-confirmed-original-not-disclosed, tampered, unverifiable, pending, or genesis; any leg that's inconclusive for a reason other than redaction resolves to unverifiable, never to verified.",
      },
      {
        title: "Redaction is marked, not hidden",
        body: "For a row with a secret-bearing payload, the admin proof endpoint masks the field server-side before the receipt is built, so raw.payload can never recompute the original hash, the receipt sets redacted: true and the row can only earn anchor-confirmed-original-not-disclosed, never verified.",
      },
      {
        title: "Versioned so the shape can change safely",
        body: "Every receipt carries v: ROW_RECEIPT_VERSION (currently 1), the schema version the kernel bumps on any change to the raw proof material's shape, so the proof-material layout a verifier reads is explicitly declared rather than assumed.",
      },
    ],
    faq: [
      {
        question: "What is an evidence receipt?",
        answer:
          "A portable, versioned proof object for a single audit-log row: the raw hash-chain link plus its per-length WORM anchor, packaged so anyone can recompute the row's verification state independently instead of trusting a server-reported verdict.",
      },
      {
        question:
          "Can I verify an evidence receipt without trusting Caisson's server?",
        answer:
          "Yes, the receipt ships raw.prevHash and raw.payload, and a standalone verifier recomputes the link hash and anchor-equality checks itself via WebCrypto; the receipt's own checks field is display-only and is never the source of the rendered state.",
      },
      {
        question: "Does a redacted row still get an evidence receipt?",
        answer:
          "Yes, but honestly weaker: the payload is masked before the receipt is built, so the client can't recompute the original hash and the row is classified anchor-confirmed-original-not-disclosed rather than verified, the anchor still confirms the stored (redacted) hash matches what was committed.",
      },
      {
        question: "Does an evidence receipt make us SOC 2 or HIPAA compliant?",
        answer:
          "No. It ships the technical control an auditor examines for tamper-evidence and generates the evidence for that check; it does not itself constitute a compliance certification.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel:
        "See how the Compliance edition ships per-row evidence receipts",
      ctaHref: "/compliance",
    },
    related: [
      "worm-audit-log",
      "hash-chain-audit-trail",
      "audit-evidence-bundle",
      "transparency-log",
    ],
  },
  {
    slug: "compliance-crosswalk",
    term: "Compliance crosswalk",
    cluster: "compliance",
    definition:
      "A compliance crosswalk maps one technical control to every regulatory framework requirement it genuinely addresses, so evidence gathered once counts across SOC 2, PCI DSS, GDPR, ISO 27001, and NIST 800-53 instead of being re-proven per regime. Caisson's computeCrosswalkRollup joins canonical controls to these regime crosswalks, deriving each cell's claim mechanically from evidence status and review depth, never editorially.",
    artifact: {
      label:
        "computeCrosswalkRollup: each cell's claim is derived mechanically, never editorially",
      lang: "ts",
      code: 'const cells: CrosswalkRollupCell[] = [];\nfor (const { framework, reference, contributions } of byRef.values()) {\n  const canonicalControlIds = [\n    ...new Set(contributions.map((c) => c.controlId)),\n  ].sort(cmp);\n  const status = contributions.reduce<ControlStatus>(\n    (acc, c) => worstStatus(acc, c.status),\n    "ready",\n  );\n\n  const allReady = contributions.every((c) => c.status === "ready");\n  const allReviewed = contributions.every((c) =>\n    isReviewedAndFresh(c.verification),\n  );\n  const regimeId = FRAMEWORK_LABEL_TO_REGIME[framework];\n  const regime =\n    regimeId === undefined\n      ? undefined\n      : input.regimeCrosswalks.find((rc) => rc.regime === regimeId);\n  const regimeRow = regime?.rows.find((r) => r.control === reference);\n  const regimeImplements = regimeRow?.claim === "implements";\n\n  const claim: "maps-to" | "implements" =\n    allReady && allReviewed && regimeImplements ? "implements" : "maps-to";',
    },
    properties: [
      {
        title: "Restates, never originates",
        body: "A cell only promotes to implements when every contributing canonical control is ready, every crosswalk reference it draws on carries a reviewed-or-better, non-stale verification record, AND the matching regime-crosswalk row (where one exists) is already implements, any one gap and the cell defaults to maps-to.",
      },
      {
        title: "A pure join over existing pointers, not a new catalog",
        body: "computeCrosswalkRollup takes catalogs, controlStatuses, and regimeCrosswalks as injected input and walks each canonical control's own crosswalk[] array, the dual-catalog OSCAL spine ADR-0333 first wrote as a deferred fork was descoped from v1's rollup because this pointer join already answered the evidenced demand.",
      },
      {
        title: "Five regimes, two join shapes",
        body: "SOC 2, PCI DSS, GDPR, ISO 27001, and NIST 800-53 all live in regimeCrosswalks. ISO and NIST rows join by canonicalControlId instead of a crosswalk[] pointer, but that join never attaches a verification record, so it can't single-handedly promote a cell to implements.",
      },
      {
        title: "Deterministic and OLIR-flagged",
        body: "Cells sort by (framework, reference) regardless of input order, and any contribution seeded from NIST's OLIR SP 800-53 <-> ISO/IEC 27001:2022 mapping carries a note repeating NIST's own subjective/incomplete warning rather than a stronger claim.",
      },
    ],
    faq: [
      {
        question: "What is a compliance crosswalk?",
        answer:
          "It's a mapping from one technical control to every regulatory framework requirement that control genuinely addresses, so evidence gathered once for SOC 2 also counts toward PCI DSS, GDPR, ISO 27001, or NIST 800-53 wherever the overlap is real. Caisson computes it as a pure join over each framework pack's existing crosswalk[] pointers, it never generates a second mapping catalog to keep in sync.",
      },
      {
        question:
          "Does mapping a control across five frameworks mean I'm compliant with all of them?",
        answer:
          "No. The rollup ships the technical control each requirement calls for and generates the evidence pointer an auditor examines; compliance status is your assessor's judgment across people, process, and technology for each regime, not a claim the crosswalk itself makes.",
      },
      {
        question:
          "What's the difference between 'maps-to' and 'implements' in Caisson's crosswalk?",
        answer:
          "'maps-to' means a Caisson mechanism addresses the same requirement's domain, the default, and the only claim any ISO 27001 or NIST 800-53 row can carry under the current legal gate. 'implements' requires three things at once: every contributing control is ready, every reference is reviewed-or-better and non-stale, and the framework's own regime-crosswalk row is already implements.",
      },
      {
        question:
          "Does the NIST 800-53 crosswalk mean Caisson is FedRAMP-ready?",
        answer:
          "No. Every nist80053Crosswalk row is capped at maps-to and cites bare 800-53 control identifiers as factual references; Caisson holds no ATO and makes no FedRAMP-readiness claim from the crosswalk's existence. The rollup makes the mapping visible, not the authorization.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel:
        "See how the Compliance bundle ships the cross-framework crosswalk rollup",
      ctaHref: "/compliance",
    },
    related: [
      "control-to-code-mapping",
      "oscal",
      "oscal-export-typescript",
      "audit-evidence-bundle",
    ],
  },
  {
    slug: "signed-audit-anchor",
    term: "Signed audit anchor",
    cluster: "security",
    definition:
      "A signed audit anchor is a per-length audit-chain commitment carrying a cryptographic signature, so a client verifies the chain's integrity against a pinned public key instead of trusting the serving API. Caisson's audit-worm package signs every anchor at mint with a dedicated Ed25519 key (domain-separated from the license-issuer key) stored alongside the existing WORM anchor.",
    artifact: {
      label:
        "AuditChainStore.append: sign the anchor's canonical core at mint with the dedicated Ed25519 signer, stored alongside",
      lang: "ts",
      code: 'const entries = await loadEntries(tx, accountId);\nconst anchor = anchorChain(entries);\n\n// Sign the anchor\'s CANONICAL CORE bytes at mint when a signer is configured.\n// `sig`+`keyId` are stored ALONGSIDE the core (additive optional fields), so legacy unsigned\n// anchors stay structurally valid and the signed core stays byte-identical to the unsigned form.\nlet anchorToStore: AuditChainAnchor = anchor;\nif (this.signer !== undefined) {\n  const sigBytes = await this.signer.sign(encodeAnchor(anchor));\n  anchorToStore = {\n    ...anchor,\n    sig: Buffer.from(sigBytes).toString("base64"),\n    keyId: this.signer.keyId,\n  };\n}\n\n// The trusted commitment lands in WORM under a LENGTH-keyed, write-once key.\nawait this.store.put(\n  anchorKey(accountId, anchor.length),\n  encodeStoredAnchor(anchorToStore),\n  { retainUntil, contentType: "application/json" },\n);',
    },
    properties: [
      {
        title: "A dedicated key, domain-separated from the license issuer",
        body: "The anchor-signing identity is a separate Ed25519 keypair from the license-issuer key, loaded from its own env var and held as an opaque KeyObject that never enumerates, logs, or JSON-serializes: an anchor-key compromise can't forge a license, and rotating the license key can't invalidate anchor-verification history.",
      },
      {
        title: "Signed additively, legacy anchors stay valid",
        body: "sig and keyId are stored alongside the existing {length, tipHash} core as optional fields, never a chain-format break: an anchor minted before a signer was configured stays structurally valid, and the signed core is byte-identical to the unsigned form.",
      },
      {
        title: "Verified against a pinned key, never the serving API",
        body: "The client and offline pack verifier check the signature with WebCrypto against a public key baked into the bundle out-of-band (never read from the row response) so a compromised or malicious API can forge a self-consistent payload/hash/anchor triple but can't forge a signature that verifies against that pinned key.",
      },
      {
        title: "Fail-safe on 'can't check', never on 'didn't check'",
        body: "A missing signature, no pinned key, or a keyId mismatch resolves to na, not fail, an unchecked signature never earns the tamper flag. Only a signature that positively fails to verify against the pinned key classifies the row tampered, the same fail-closed direction as the other two verification legs.",
      },
    ],
    faq: [
      {
        question: "What is a signed audit anchor?",
        answer:
          "A signed audit anchor is a per-length commitment over an audit chain (length + tip hash) that also carries an Ed25519 signature, minted at append time. It lets a client or offline verifier check the chain's integrity against a public key it already trusts, instead of trusting whatever the row-serving API happens to return.",
      },
      {
        question:
          "Why sign the anchor instead of just trusting the API that serves it?",
        answer:
          "Because the API is exactly what a compromise would control. Without a signature, a malicious or breached API can return a self-consistent (payload, hash, anchor) triple that recomputes clean. A signature over the anchor's core, checked against a key pinned out-of-band in the client bundle, is a trust root the row-serving API itself cannot forge.",
      },
      {
        question:
          "Does the anchor-signing key double as the software-license key?",
        answer:
          "No, they're deliberately separate Ed25519 keypairs. Domain separation means an anchor-signing key compromise can't be used to forge a software license, and rotating the license key never invalidates anchor-verification history.",
      },
      {
        question:
          "Does a signed audit anchor alone make us SOC 2 or HIPAA compliant?",
        answer:
          "No. It ships the technical tamper-evidence control an auditor checks for and generates verifiable signature evidence for every anchor; it doesn't itself constitute a compliance certification, which still depends on your organization's administrative controls and the audit process.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel: "See how audit-worm signs every anchor with a dedicated key",
      ctaHref: "/marketplace/modules/audit-worm",
    },
    related: [
      "fail-closed",
      "token-hash-at-rest",
      "per-tenant-encryption-keys",
    ],
  },
  {
    slug: "agent-trajectory",
    term: "Agent trajectory",
    cluster: "ai-infra",
    definition:
      "An agent trajectory is the complete, ordered record of what an AI agent run did: every model call, tool proposal, approval, and result, in sequence. Caisson's agent-trajectory package makes that record append-only and engine-neutral, eleven strict event kinds folding into one deterministic projection, with prompt and tool bodies carried only as sha256 digest references, never inlined.",
    artifact: {
      label:
        "createMemoryTrajectoryStore().append: idempotent on (runId, seq), ConflictError on a rewrite or a gap",
      lang: "ts",
      code: 'async append(event: TrajectoryEvent): Promise<void> {\n  const parsed = parseStrict(TrajectoryEvent, event);\n  const log = runs.get(parsed.runId) ?? [];\n  const expected = log.length; // the next free (0-based) seq slot for this run\n\n  if (parsed.seq === expected) {\n    log.push(parsed);\n    runs.set(parsed.runId, log);\n    return;\n  }\n\n  if (parsed.seq < expected) {\n    // Already-recorded slot: idempotent iff byte-identical (both sides are schema-parsed, so key\n    // order is schema-determined and JSON.stringify is a canonical equality), else a rewrite.\n    const existing = log[parsed.seq];\n    if (existing !== undefined && stableEqual(existing, parsed)) return;\n    throw new ConflictError(\n      "append-only: seq already recorded with different content",\n      { runId: parsed.runId, seq: parsed.seq },\n    );\n  }\n\n  // parsed.seq > expected — a gap; append-only forbids skipping a slot.\n  throw new ConflictError("append-only: seq gap", {\n    runId: parsed.runId,\n    seq: parsed.seq,\n    expected,\n  });\n}',
    },
    properties: [
      {
        title: "Eleven event kinds, one strict schema",
        body: "TrajectoryEvent is a Zod discriminatedUnion over run.started, run.finished, step.started/finished, model.call, model.usage, tool.proposed/approved/denied/result, and checkpoint, each payload .strict() so an unknown field is rejected at the boundary, not silently carried.",
      },
      {
        title: "Sensitive bodies never inline, only referenced",
        body: "Prompt text, tool arguments, tool results, and checkpoint state each carry only a DigestRef ({ digest: sha256-hex, byteLength, encRef? }); the trajectory log itself is safe to persist, replay, and anchor without ever holding the bodies it points at.",
      },
      {
        title: "Append rejects rewrites and gaps, not just duplicates",
        body: "append() treats seq as a monotonic 0-based per-run sequence: a repeat of an already-recorded slot with byte-identical content is a no-op (safe retry), a different event at that slot throws ConflictError, and a seq past the next free slot throws as a gap, three distinct outcomes, not one generic reject.",
      },
      {
        title:
          "Replay folds to a byte-identical projection regardless of arrival order",
        body: "project() sorts events by seq before folding, so a shuffled batch (out-of-order stream delivery) resolves to the same canonical RunProjection every time, the step tree, per-billing-status usage totals, and checkpoint marks are a pure function of the log, never of wall-clock or map-iteration order.",
      },
    ],
    faq: [
      {
        question: "What is an agent trajectory?",
        answer:
          "The ordered event log of one AI agent run: every step it entered, every model call and its usage, every tool it proposed, whether that tool was approved or denied, and the result. Caisson's agent-trajectory package pins this to eleven closed event kinds validated by one Zod discriminatedUnion schema, so a trajectory is a typed contract, not a free-form transcript.",
      },
      {
        question:
          "Does an agent trajectory log expose the actual prompts and tool outputs?",
        answer:
          "No, not inline. Prompt text, tool argument bodies, tool result bodies, and checkpoint state are each carried only as a DigestRef (a sha256 digest, a byte length, and an optional pointer to an encrypted store) never as raw content in the event itself, so the log can be persisted or anchored without leaking what it references.",
      },
      {
        question:
          "Can a trajectory event log be edited or replayed with a different outcome later?",
        answer:
          "No. append() enforces a gapless, rewrite-free seq per run: an already-recorded slot only accepts a byte-identical retry, anything else throws ConflictError, and project() always folds the same sorted event set to the same output, so replaying a stored trajectory can't drift from what was originally recorded.",
      },
      {
        question: "Is an agent trajectory log itself a compliance control?",
        answer:
          "It's the technical substrate an audit trail for agent activity is built on: a strict, append-only record of what the agent did and why a tool call was approved or denied. Caisson ships that substrate and lets it feed an evidence pack; it doesn't itself constitute a SOC 2 or HIPAA certification.",
      },
    ],
    sells: {
      edition: "Agentic-Dev",
      ctaLabel:
        "See how agent-trajectory records every governed run, append-only",
      ctaHref: "/agentic-dev",
    },
    related: ["governed-agents", "ai-guardrails", "mcp-server"],
  },
  {
    slug: "token-hash-at-rest",
    term: "Token hashing at rest",
    cluster: "security",
    definition:
      "Token hashing at rest means a session token is never stored as its raw, replayable value, only a derived lookup key sits in the database. Caisson's auth package derives an HMAC-SHA-256 lookup key from the raw token, and the site's better-auth adapter wrap swaps every session query to that key, fail-closed if the HMAC key is missing.",
    artifact: {
      label:
        "deriveTokenLookupKey: the raw token never lands in the database, only its HMAC-SHA-256 lookup key",
      lang: "ts",
      code: 'import { createHmac } from "node:crypto";\n\n/**\n * HMAC-SHA-256 of `rawToken` keyed by `hmacKey`, hex-encoded (64 lowercase hex characters).\n * Deterministic — same inputs always produce the same lookup key, so it doubles as an indexed\n * database lookup value. The key never touches the database: a Postgres dump alone cannot be\n * reversed back into a usable session cookie without `hmacKey`.\n */\nexport function deriveTokenLookupKey(\n  rawToken: string,\n  hmacKey: string,\n): string {\n  return createHmac("sha256", hmacKey).update(rawToken).digest("hex");\n}',
    },
    properties: [
      {
        title: "One derived value, no schema change",
        body: "Instead of adding a second column for a hashed value, the HMAC-SHA-256 lookup key replaces the raw token directly in the existing session.token column better-auth already unique-indexes, a plain indexed equality match on the lookup key, no new migration.",
      },
      {
        title: "The adapter wrap is the single write/read seam",
        body: "wrapSessionAdapter attaches at the one construction site in auth-server.ts and only intercepts the session model's token field, every other model, and every session query that doesn't touch token, passes straight through to the underlying better-auth adapter untouched.",
      },
      {
        title: "Throws loudly on an unrecognized query shape, never guesses",
        body: "rewriteTokenWhere only rewrites the two where-clause shapes better-auth's session queries build today (a single eq/string value or an in/string-array value); a future better-auth upgrade that changes that shape hits an explicit throw instead of silently producing a broken or unhashed lookup.",
      },
      {
        title: "Fail-closed boot, not a raw-token fallback",
        body: "getAuth() throws before starting if DATABASE_URL and BETTER_AUTH_SECRET are configured but SESSION_TOKEN_HMAC_KEY is missing, a forgotten env var crashes boot loudly instead of quietly falling back to storing raw tokens.",
      },
    ],
    faq: [
      {
        question: "What does it mean to hash a session token at rest?",
        answer:
          "The value stored in the database is a derived lookup key, not the raw bearer token a browser presents on each request, so a database leak alone can't be replayed as a live session. Caisson derives that key with HMAC-SHA-256 keyed by a secret that never touches the database, so reversing a dump back into a usable cookie also requires that separate key.",
      },
      {
        question:
          "Does hashing the token at rest need a timingSafeEqual comparison?",
        answer:
          "No, there's no application-level secret comparison in this design at all. The database does a plain indexed equality lookup on the HMAC key itself, so there's nothing for timingSafeEqual to guard here; that guard matters when code directly compares two raw secret strings, which this design never does.",
      },
      {
        question:
          "Does hashing session tokens at rest make Caisson SOC 2 or HIPAA compliant?",
        answer:
          "No. It ships the technical control those frameworks expect for credential protection at rest, and the fail-closed boot behavior is evidence an auditor can examine; it is not itself a certification.",
      },
      {
        question:
          "What happens to existing logged-in sessions when this ships?",
        answer:
          "A hard cutover: legacy raw-token session rows are dropped or invalidated at deploy and every signed-in session ends. Caisson accepted that pre-launch (there are no real buyer sessions yet to preserve) rather than ship a more complex dual-read migration path.",
      },
    ],
    sells: {
      edition: "Base (auth, Apache-2.0, free)",
      ctaLabel: "Read how @caisson/auth hashes session tokens at rest",
      ctaHref: "/docs/base/auth",
    },
    related: ["fail-closed", "row-level-security", "field-level-encryption"],
  },
  {
    slug: "durable-outbox",
    term: "Durable outbox",
    cluster: "compliance",
    definition:
      "A durable outbox persists delivery intent in the database before any external call, so a crash between the call and the write can't silently drop or duplicate work. Caisson's anchor-outbox package writes a pending row before every external-anchoring submission, then guards each state transition, so a lost response resolves to an operator reconciliation state instead of a blind duplicate retry.",
    artifact: {
      label:
        "AnchorOutbox.enqueuePending: persist intent before egress, idempotent on the natural key",
      lang: "ts",
      code: "async enqueuePending(key: AnchorOutboxKey): Promise<AnchorOutboxRow> {\n  const k = parseStrict(anchorOutboxKeySchema, key);\n  return withTenant(this.#db, k.accountId, async (tx) => {\n    await tx.query(\n      `INSERT INTO anchor_outbox (id, account_id, target, anchor_length, anchor_digest, state)\n       VALUES ($1, $2, $3, $4, $5, 'pending')\n       ON CONFLICT (account_id, target, anchor_length, anchor_digest) DO NOTHING`,\n      [randomUUID(), k.accountId, k.target, k.anchorLength, k.anchorDigest],\n    );\n    const row = await selectRow(tx, k);\n    if (row === null) {\n      throw new InternalError(\"anchor_outbox row vanished after enqueue\", {\n        accountId: k.accountId,\n      });\n    }\n    return toRow(row);\n  });\n}",
    },
    properties: [
      {
        title: "Intent persisted before egress",
        body: "enqueuePending writes a pending row to Postgres before any network call is made, and markSubmitted writes submitted before the submit() call resolves, the crash window always closes on the side of a recorded intent, never a silent gap.",
      },
      {
        title: "State transitions are DB-guarded, not app-trusted",
        body: 'Every transition is an UPDATE … WHERE state = ANY(from) RETURNING id; an empty result throws ConflictError instead of forcing the write. markSubmitted\'s only valid `from` is pending, so "no second submit" is structural, not a convention.',
      },
      {
        title: "Response loss resolves to reconcile, never a blind retry",
        body: "When a submitted row's receipt never lands, markNeedsReconcile moves it to a terminal needs_reconcile state for an operator to resolve, closing the ambiguity without risking a duplicate submission to an external, often append-only, target.",
      },
      {
        title: "Tenant-scoped by default, admin-readable for sweeps",
        body: "Every method runs under withTenant so a row can never be read or written outside its own account; the cross-tenant reconcile sweep the operator control plane needs rides a separate, explicitly granted admin_write policy on the same table.",
      },
    ],
    faq: [
      {
        question:
          "What happens if the anchoring service crashes right after the TSA or log accepts the submission?",
        answer:
          "The row stays submitted, not receipted. A reconcile sweep finds it stuck in that state and surfaces it to the operator as needs_reconcile, the response-loss window between acceptance and a durable receipt is closed by a human decision, not a guess.",
      },
      {
        question: "Why doesn't a failed submission just retry automatically?",
        answer:
          "Because the target can be a public transparency log or TSA: a blind retry after a lost response risks minting a second, irrevocable entry, which is worse than a delayed checkpoint. markNeedsReconcile surfaces the ambiguous case instead of resubmitting it.",
      },
      {
        question: "Can the same anchor submission be sent twice by mistake?",
        answer:
          "No, each state transition is a DB-guarded UPDATE that only fires from its expected prior state (e.g. markSubmitted only runs from pending), so a row already submitted or receipted structurally can't be re-submitted.",
      },
      {
        question: "Does the durable outbox itself prove compliance?",
        answer:
          "No. It ships the technical control for reliable, non-duplicating delivery of anchor submissions and generates the state history an auditor can examine; it doesn't itself constitute a certification.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel:
        "See how the Compliance edition anchors every checkpoint with a durable outbox",
      ctaHref: "/compliance",
    },
    related: ["worm-audit-log", "rfc-3161-timestamping", "transparency-log"],
  },
  {
    slug: "idempotency-key",
    term: "Idempotency key",
    cluster: "licensing",
    definition:
      "An idempotency key is a caller-supplied token that lets a retried request apply its effect at most once. Caisson's credits ledger and Paddle webhook handler both claim the key via INSERT ON CONFLICT DO NOTHING RETURNING: a fresh key runs the grant or debit, a replay returns the same balance with zero new writes, so a resent webhook never double-grants.",
    artifact: {
      label:
        "processEvent in packages/billing-orchestration/src/idempotency.ts: claim the key once via ON CONFLICT DO NOTHING RETURNING, skip fn on replay",
      lang: "ts",
      code: 'async function claim(tx: TenantExecutor, eventKey: string): Promise<boolean> {\n  const { rows } = await tx.query<{ event_key: string }>(\n    `INSERT INTO billing_processed_event (event_key, account_id)\n       VALUES ($1, current_setting($2, true))\n     ON CONFLICT (event_key) DO NOTHING\n     RETURNING event_key`,\n    [eventKey, TENANT_GUC],\n  );\n  return rows.length === 1;\n}\n\n/** OUTER layer: run `fn` for `sourceEventId` exactly once across re-deliveries. */\nexport async function processEvent(\n  tx: TenantExecutor,\n  sourceEventId: string,\n  fn: () => Promise<void>,\n): Promise<ProcessResult> {\n  assertValidSourceEventId(sourceEventId, "processEvent");\n  const fresh = await claim(tx, sourceEventId);\n  if (!fresh) return { alreadyProcessed: true };\n  await fn();\n  return { alreadyProcessed: false };\n}',
    },
    properties: [
      {
        title: "One INSERT, atomic claim-or-skip",
        body: "Both layers use the same primitive: INSERT ... ON CONFLICT DO NOTHING RETURNING. A fresh key inserts and returns a row; a duplicate key returns zero rows instead of raising, so the caller checks row count rather than catching a unique-violation exception.",
      },
      {
        title: "Dual-layer coverage: DB writes and side-effects",
        body: "The credits ledger's UNIQUE (source_event_id, event_type) index makes the money write itself idempotent. billing-orchestration's processEvent/withIdempotentSideEffect add an outer claim over the whole handler and a per-effect claim, so a detached post-commit push (Discord role grant, a confirmation email) also fires at most once across re-deliveries.",
      },
      {
        title: "Commits atomically with the work it guards",
        body: "Every claim runs inside the same withTenant transaction as the grant or debit it protects: if the guarded work throws, the claim rolls back too, so the next delivery retries cleanly instead of finding a stale claim with no matching effect.",
      },
      {
        title: "Caller picks the key shape, mutually exclusive",
        body: "credits.ts's idemColumns() requires exactly one of sourceEventId (a provider event/invoice/payment id) or idempotencyKey (a caller-chosen per-account key) (never both, never neither) so every ledger row always has one clear identity to dedupe on.",
      },
    ],
    faq: [
      {
        question:
          "How does Caisson stop a resent Paddle webhook from granting credits twice?",
        answer:
          "Two layers, both keyed on Paddle's stable ids. The outer processEvent() claims the delivery's event_id once per webhook.ts call, skipping the whole handler on a re-delivery; the inner credit_event ledger separately claims grant()/debit()'s sourceEventId (an invoice or payment id) via ON CONFLICT DO NOTHING, so even a bypass of the outer claim can't double-grant.",
      },
      {
        question:
          "What happens if I retry a credits API call after a timeout with no response?",
        answer:
          "Supply the same idempotencyKey (or sourceEventId) on the retry. insertEvent's INSERT ON CONFLICT DO NOTHING RETURNING returns zero rows for the duplicate, grant()/debit() report { idempotent: true } with the account's current balance, and no second ledger row or wallet change happens.",
      },
      {
        question:
          "Can two different events accidentally collide on the same idempotency key?",
        answer:
          "Caisson's outer claim table shares one namespace between whole-event keys and per-side-effect keys (`${sourceEventId}:${sideEffect}`), so assertValidSourceEventId rejects any sourceEventId containing a colon outright, it would alias a composite side-effect key. A key must also be non-empty; a blank key would collapse every unattributed event onto one row.",
      },
    ],
    sells: {
      ctaLabel: "See how Caisson prices usage with prepaid credits",
      ctaHref: "/marketplace/plans",
    },
    related: [
      "credit-based-billing",
      "offline-license-verification",
      "ed25519-license-keys",
      "software-entitlement",
    ],
  },
  {
    slug: "canonical-json",
    term: "Canonical JSON",
    cluster: "security",
    definition:
      "Canonical JSON is a deterministic serialization where semantically-equal payloads with different key orders produce identical bytes, so a hash or signature over the value is reproducible everywhere. Caisson's kernel canonicalize sorts object keys recursively, keeps array order, and rejects non-finite numbers, feeding every audit-chain hash, signed anchor, and license claim signature.",
    artifact: {
      label:
        "canonicalize: sortValue recursively sorts keys, preserves array order, rejects non-finite numbers, then JSON.stringify",
      lang: "ts",
      code: 'function sortValue(value: JsonValue): JsonValue {\n  if (value === null || typeof value !== "object") {\n    if (typeof value === "number" && !Number.isFinite(value)) {\n      throw new Error(\n        `audit-chain: non-finite number is not canonicalizable: ${String(value)}`,\n      );\n    }\n    return value;\n  }\n  if (Array.isArray(value)) return value.map(sortValue);\n  const obj = value as { readonly [key: string]: JsonValue };\n  const out: { [key: string]: JsonValue } = {};\n  for (const key of Object.keys(obj).sort()) {\n    out[key] = sortValue(obj[key] as JsonValue);\n  }\n  return out;\n}\n\nexport function canonicalize(value: JsonValue): string {\n  return JSON.stringify(sortValue(value));\n}',
    },
    properties: [
      {
        title: "One function, every hash and signature in the platform",
        body: "canonicalize is imported directly by audit-chain's hashChainLink and contentHash, the evidence pack's receipt hashing, migration-assembly's cumulative hash, license-issue's issueLicense (which signs canonicalize(parsedClaims) into the wire token), and license-verify's verifyLicense, one serialization primitive backs every place Caisson hashes or signs a JSON payload, with no second codepath that could quietly drift from it.",
      },
      {
        title: "Format conformance, not just signature conformance",
        body: "license-verify's verifyLicense checks the Ed25519 signature first, then re-canonicalizes the parsed claims and rejects the token outright if the signed bytes aren't byte-identical to that canonical form, a token can't be re-serialized with different key order or whitespace and still verify, even carrying an authentic signature.",
      },
      {
        title: "Non-finite numbers throw instead of silently serializing",
        body: "sortValue rejects Infinity and NaN with a thrown error rather than letting JSON.stringify silently print them as null; a value that can't round-trip through canonical bytes never gets hashed or signed as though it could.",
      },
      {
        title:
          "A frozen algorithm, any byte change invalidates every stored hash",
        body: "canonical.ts documents its own output as the single source of canonical bytes for the chain hash: recursive key sort, kept array order, JSON.stringify. Any change to that algorithm is a chain-format break, because it would silently invalidate every hash already computed and stored.",
      },
    ],
    faq: [
      {
        question: "What is canonical JSON?",
        answer:
          "Canonical JSON is a deterministic serialization rule that guarantees two objects with the same keys and values, but written or transmitted in a different order, produce byte-identical output. Caisson's kernel implements it by sorting object keys recursively before JSON.stringify, so a hash or signature taken over the result is reproducible regardless of how the original payload was assembled or transmitted.",
      },
      {
        question: "Can a license token verify with its claim keys reordered?",
        answer:
          "No. Caisson's verifier checks the Ed25519 signature first, then re-canonicalizes the parsed claims and compares that against the exact bytes that were signed; a payload re-serialized in a different key order fails the format-conformance check even though the same JSON value would produce a valid signature elsewhere.",
      },
      {
        question: "What happens if a value contains Infinity or NaN?",
        answer:
          "canonicalize throws rather than silently serializing it. Those aren't valid JSON values, naive JSON.stringify would print them as null, and letting that pass could make two different in-memory values hash identically. The function refuses to canonicalize anything that can't round-trip.",
      },
      {
        question:
          "Does canonical serialization by itself make an audit trail compliant?",
        answer:
          "No. It's the deterministic-hashing primitive underneath the audit chain and license verification, not a compliance control on its own. It ships the technical guarantee that a hash or signature is reproducible and generates the evidence downstream controls rely on; it doesn't itself constitute a SOC 2 or HIPAA certification.",
      },
    ],
    sells: {
      edition: "Base (kernel, Apache-2.0, free)",
      ctaLabel: "Read how the kernel canonicalizes every hash and signature",
      ctaHref: "/docs/base/kernel",
    },
    related: [
      "signed-audit-anchor",
      "token-hash-at-rest",
      "fail-closed",
      "additional-authenticated-data",
    ],
  },
  {
    slug: "additional-authenticated-data",
    term: "Additional authenticated data (AAD)",
    cluster: "security",
    definition:
      "Additional authenticated data (AAD) is data an AEAD cipher authenticates but never encrypts, so altering it breaks decryption even though it stays in the clear. Caisson's field-crypto module binds tenant id, key version, and column identity into every ciphertext's AAD, adding the row id as a fourth element on regulated fields so a relocated row fails to decrypt too.",
    artifact: {
      label:
        "buildAad: conditional construction: an omitted rowId stays byte-identical to the legacy 3-tuple, present it becomes a row-bound 4-tuple",
      lang: "ts",
      code: 'export function buildAad(\n  tenantId: string,\n  keyVersion: number,\n  columnContext: string,\n  rowId?: string,\n): Buffer {\n  // Conditional construction: omitting `rowId` must yield the SAME bytes as the legacy 3-tuple —\n  // pushing `undefined` would serialize as `null` and break every existing ciphertext + golden.\n  const tuple =\n    rowId === undefined\n      ? [tenantId, keyVersion, columnContext]\n      : [tenantId, keyVersion, columnContext, rowId];\n  return Buffer.from(JSON.stringify(tuple), "utf8");\n}',
    },
    properties: [
      {
        title: "Authenticated, never hidden",
        body: "GCM authenticates the AAD bytes but does not encrypt them, buildAad's tenant/key-version/column tuple travels alongside the ciphertext in the clear. Tampering with any element, or moving the ciphertext under different metadata, makes the AEAD authentication tag fail to verify on decrypt.",
      },
      {
        title: "Two honest paths: 3-tuple and row-bound 4-tuple",
        body: "The transparent encryptedColumn Drizzle customType (column.ts) sees only the cell value, never the row's primary key, so it stays on the tenant/keyVersion/column 3-tuple with no cross-row tamper-evidence, for low-sensitivity fields only. encryptField/decryptField (encrypt-field.ts) require the caller to pass the row's stable crypto.randomUUID() PK as a fourth AAD element; SEC/HIPAA columns must use this row-bound path.",
      },
      {
        title: "The rowId must be minted before the INSERT",
        body: "encryptField's AAD is computed at encrypt time, before the row exists in the database, a DB-generated serial/identity PK is assigned only after the INSERT, too late to bind. encrypt-field.ts requires a client-minted crypto.randomUUID() PK instead, and assertRowId rejects a blank one up front rather than binding a degenerate identity.",
      },
      {
        title: "A JSON tuple, not a delimiter-joined string",
        body: "The AAD is JSON.stringify([tenantId, keyVersion, columnContext, rowId?]), JSON's own quoting and escaping separate the fields, so there's no delimiter for a crafted value to inject and no ambiguity about where one element ends and the next begins.",
      },
    ],
    faq: [
      {
        question:
          "What is additional authenticated data (AAD) in AEAD encryption?",
        answer:
          "AAD is metadata an AEAD cipher like AES-GCM authenticates alongside the ciphertext without encrypting it, it travels in the clear, but any change to it makes the authentication tag fail to verify. Caisson uses it to bind a ciphertext to the exact tenant, key version, and column it was written under.",
      },
      {
        question:
          "Does Caisson's AAD stop a ciphertext being moved to a different row?",
        answer:
          "Only on the row-bound path. encryptField/decryptField add the row's crypto.randomUUID() PK as a fourth AAD element, so relocating that ciphertext to another row of the same tenant/column/key-version fails to decrypt. The transparent encryptedColumn Drizzle type never sees a row id, so it stays on the 3-tuple and carries no cross-row guarantee, it's scoped to low-sensitivity fields only.",
      },
      {
        question: "Can someone read the AAD without the decryption key?",
        answer:
          "Yes, AAD is authenticated, not confidential, so the tenant id, key version, and column context are visible alongside the ciphertext by design. Those values (an id, a version number, a column name) aren't secrets themselves, and the AES-256-GCM key that actually protects the plaintext stays separately gated behind field-crypto's provider.",
      },
      {
        question:
          "Does AAD binding alone satisfy a HIPAA or SOC 2 encryption control?",
        answer:
          "No single primitive does. AAD binding ships the technical control regulators check for (a ciphertext cryptographically tied to its tenant, column, and, on regulated fields, its row) and generates the evidence field-crypto's tests exercise. Certification is your organization's and its auditor's determination, not a property of the code.",
      },
    ],
    sells: {
      edition: "Compliance",
      ctaLabel:
        "See how field-crypto binds every ciphertext to its tenant, column, and row",
      ctaHref: "/marketplace/modules/field-crypto",
    },
    related: [
      "field-level-encryption",
      "envelope-encryption",
      "per-tenant-encryption-keys",
      "row-level-security",
    ],
  },
  {
    slug: "pii-redaction",
    term: "PII redaction",
    cluster: "ai-infra",
    definition:
      "PII redaction strips personally identifiable information from text before it reaches an LLM provider or a log, so raw values never leave the trust boundary. Caisson's guardrails package detects email addresses, US Social Security numbers, Luhn-valid credit card numbers, and phone numbers, then masks, hashes, or reversibly tokenizes each match: four regex-based detector classes, not exhaustive PII coverage.",
    artifact: {
      label:
        "redactPii: mask → [KIND], hash → [KIND:12-hex], irreversible, matches returned as metadata only",
      lang: "ts",
      code: 'export type RedactMode = "mask" | "hash";\nexport type PiiMode = RedactMode | "tokenize";\n\n/**\n * Irreversibly redact every PII hit. `mask` → `[KIND]`; `hash` → `[KIND:<12-hex>]` (stable per\n * value). Returns the redacted text plus metadata-only matches (no raw value re-exposed downstream).\n */\nexport function redactPii(\n  text: string,\n  mode: RedactMode,\n): { redacted: string; matches: PiiMatch[] } {\n  const matches = detectPii(text);\n  const replace =\n    mode === "mask"\n      ? (m: PiiMatch): string => `[${m.kind.toUpperCase()}]`\n      : (m: PiiMatch): string =>\n          `[${m.kind.toUpperCase()}:${sha256Hex(m.value).slice(0, 12)}]`;\n  return { redacted: rewrite(text, matches, replace), matches };\n}',
    },
    properties: [
      {
        title: "Four regex-based detector classes, deterministically resolved",
        body: "detectPii runs an email, SSN, Luhn-validated credit-card, and phone regex over the text, then resolves any overlapping matches by earliest start, then longest span, then kind name, so the same input always redacts identically across runs.",
      },
      {
        title: "Three modes behind one detector",
        body: "redactPii covers mask (`[KIND]`) and hash (`[KIND:<12-hex>]`, stable per value so equal inputs correlate without exposure); tokenizePii is the third mode, sealing the original via field-crypto instead of replacing it with a fixed placeholder.",
      },
      {
        title: "Tokenize is the sole reversible path",
        body: "tokenizePii seals each hit with field-crypto's sealField under a bound AAD column context and swaps in an opaque `[[PII:kind:i]]` placeholder; detokenizePii opens the envelope under the same tenant context to restore it, and silently skips any placeholder a provider dropped rather than re-injecting it blind.",
      },
      {
        title: "A separate path redacts secret-bearing keys, not PII text",
        body: "@caisson/kernel's redactValue walks an object and masks any property whose key name matches a secret allowlist (password, token, apiKey, and similar), a different mechanism for structured payloads, kept distinct from pii.ts's free-text PII detection.",
      },
    ],
    faq: [
      {
        question: "What PII does Caisson's redaction actually detect?",
        answer:
          "Four regex-based detector classes: email addresses, US Social Security numbers (3-2-4), credit card numbers validated with a Luhn check, and phone numbers. It does not detect names, physical addresses, IP addresses, or non-US ID formats, this is a bounded detector set, not exhaustive PII coverage.",
      },
      {
        question:
          "What's the difference between mask, hash, and tokenize mode?",
        answer:
          "Mask replaces a hit with a fixed class placeholder like [EMAIL]; hash replaces it with a placeholder plus a stable 12-hex SHA-256 prefix, so equal values map to equal tokens without exposing the original. Both are irreversible. Tokenize is the third, reversible mode.",
      },
      {
        question: "Can a redacted value be recovered later?",
        answer:
          "Only in tokenize mode. The original is sealed via field-crypto's sealField into an opaque placeholder and restored with detokenizePii's openField call under the same tenant context, the redact-before-egress, restore-on-return round trip. Mask and hash mode discard the original; there is nothing to recover.",
      },
      {
        question: "Does PII redaction alone make us HIPAA or GDPR compliant?",
        answer:
          "No. It ships the technical control that keeps personal data out of prompts, logs, and provider egress, and it generates evidence of that control operating; it does not itself constitute a certification or a compliance program.",
      },
    ],
    sells: {
      edition: "AI Production Kit",
      ctaLabel: "See how guardrails redact PII before every inference call",
      ctaHref: "/marketplace/modules/guardrails",
    },
    related: [
      "ai-guardrails",
      "governed-agents",
      "llm-eval-gate",
      "mcp-server",
    ],
  },
  {
    slug: "prompt-injection",
    term: "Prompt injection",
    cluster: "ai-infra",
    definition:
      "Prompt injection is text crafted to hijack an LLM's instructions, an attack class no vendor has solved. Caisson makes no detection claim: `@caisson/guardrails` runs a fail-closed moderator plus an unconditional secret-shape gate on every input/output leg, and the agent runtime parks any `approvalRequired` tool call for external approval before it executes, so a hijacked model can't spend or act unchecked.",
    artifact: {
      label:
        "runToolCallBatch: an approvalRequired tool never executes on the model's say-so, it parks a durable snapshot and waits",
      lang: "ts",
      code: 'if (impl.approvalRequired === true) {\n  if (engine.runState === undefined) {\n    await engine.append("step.finished", {\n      stepId,\n      status: "error",\n      errorCode: "tool",\n    });\n    throw new LoopFailure(\n      "tool",\n      `tool "${call.toolName}" requires approval but no runState store was configured`,\n    );\n  }\n  const parkedState: ParkedState = {\n    stepId,\n    calls,\n    callIndex: i,\n    messages: [...state.messages],\n    stepsUsed: state.stepsUsed,\n    creditsSpent: state.creditsSpent,\n  };\n  await engine.runState.park({\n    runId: engine.runId,\n    toolCallId,\n    resumeSeq: engine.currentSeq(),\n    parkedState,\n  });\n  throw new LoopParked(toolCallId);\n}',
    },
    properties: [
      {
        title: "A gated tool call parks, it never runs on the model's word",
        body: "runToolCallBatch checks impl.approvalRequired before executing any proposed tool call. A gated call appends tool.proposed, records a resumable ParkedState snapshot via RunStateStore.park, and throws LoopParked instead of calling impl.execute, so a model steered by injected text can propose a dangerous call but cannot make it happen without a separate approveToolCall decision.",
      },
      {
        title:
          "The credential-shape gate runs unconditionally, injection or not",
        body: "guard.ts's moderate() calls looksLikeSecret(text) before any moderator, on both the input and output leg, with no policy field to disable it, an injected instruction that tries to get the model to echo out a credential still hits this gate on the way out.",
      },
      {
        title: "A moderator outage still fails closed",
        body: "moderateWithDeadline races the configured Moderator against a timeout; a driver throw, rejection, or deadline miss blocks the call unless the policy explicitly sets failOpen: true, a moderator failure can't be used as the injection vector to slip an unmoderated prompt through.",
      },
      {
        title: "An approved call executes exactly once, even under a race",
        body: "resumeToolLoop re-validates the pending approval in SQL via RunStateStore.claimResume, a CAS: two concurrent resumes of the same approval can't both execute the tool, and a mismatched or already-claimed toolCallId throws ConflictError before any tool or model logic runs.",
      },
    ],
    faq: [
      {
        question: "Does Caisson detect prompt injection attempts?",
        answer:
          'No, Caisson makes no detection claim. GuardCategory carries an "injection" class in the schema for a custom Moderator to report, but the shipped drivers never emit it. The real containment is structural: fail-closed input/output gates and a tool-approval park, not a classifier that spots the attack.',
      },
      {
        question:
          "If an attacker gets a prompt to override the model's instructions, what stops it from taking action?",
        answer:
          "The tool-approval gate. Any LoopTool marked approvalRequired never executes from runToolCallBatch, the call parks (tool.proposed appended, a durable snapshot recorded) and the run waits for an external approveToolCall/denyToolCall decision, so a hijacked model can propose a call but can't execute one unsupervised.",
      },
      {
        question:
          "Can an injected prompt make the model exfiltrate an API key or credential?",
        answer:
          "The credential-shape scan runs unconditionally on both legs before any moderator call, looksLikeSecret has no policy switch to disable it, so a credential-shaped span in the model's own output is blocked at the same chokepoint every input passes through, live moderator or not.",
      },
      {
        question:
          "What happens if the content moderator is down when a malicious prompt comes through?",
        answer:
          "The call blocks. guard.ts fails closed by default: a moderator timeout, thrown error, or rejection is treated as a block, not a pass-through, unless the policy explicitly opts into failOpen: true.",
      },
    ],
    sells: {
      edition: "AI Production Kit",
      ctaLabel: "See how guardrails gate every inference call",
      ctaHref: "/marketplace/modules/guardrails",
    },
    related: ["ai-guardrails", "governed-agents"],
  },
  {
    slug: "deterministic-replay",
    term: "Deterministic replay",
    cluster: "ai-infra",
    definition:
      "Deterministic replay means folding the same event log always produces the same byte-identical result, regardless of arrival order. Caisson's agent-trajectory package sorts every event by seq before folding into a RunProjection, so a shuffled batch resolves to one canonical output, the shape evals score and the audit chain anchors, safe to persist without the raw bodies it references.",
    artifact: {
      label:
        "project(): sort-by-seq fold to a byte-identical RunProjection, regardless of arrival order",
      lang: "ts",
      code: 'export function project(events: readonly TrajectoryEvent[]): RunProjection {\n  const ordered = [...events].sort((a, b) => a.seq - b.seq);\n  const runId = ordered[0]?.runId ?? "";\n\n  let status: RunProjection["status"] = "pending";\n  // Key order is the projection\'s byte order: metered → priced → estimated → unsupported\n  const usageTotals: Record<BillingStatus, UsageTotal> = {\n    metered: zeroTotal(),\n    priced: zeroTotal(),\n    estimated: zeroTotal(),\n    unsupported: zeroTotal(),\n  };\n  const checkpoints: CheckpointMark[] = [];\n\n  for (const e of ordered) {\n    switch (e.kind) {\n      case "step.finished": {\n        const node = nodes.get(e.payload.stepId);\n        if (node !== undefined) node.status = e.payload.status;\n        break;\n      }\n      // ... run.*/step.*/model.*/checkpoint each fold their own slice\n    }\n  }\n\n  return { runId, status, steps: roots, usageTotals, checkpoints };\n}',
    },
    properties: [
      {
        title: "Sort-by-seq before fold, every time",
        body: "Both project() and projectToolCalls open with the same line ([...events].sort((a, b) => a.seq - b.seq)) before folding anything, so a shuffled batch (out-of-order stream delivery) resolves to one canonical result instead of drifting with delivery order.",
      },
      {
        title: "Fixed key order makes the output byte-comparable",
        body: "RunProjection's fields are always written in the same order (runId, status, steps, usageTotals, checkpoints) and usageTotals always carries all four billingStatus bands in a fixed sequence, so JSON.stringify of two projections of the same log is byte-identical, not merely deep-equal.",
      },
      {
        title: "Two independent projections over the same log",
        body: "project() folds run/step/usage/checkpoint state into a RunProjection; projectToolCalls folds tool.proposed/approved/denied/result into a scored tool-call list. They read the same sorted event log but never share mutable state, so adding the tool-call fold didn't change one byte of project()'s existing output.",
      },
      {
        title: "Digest-ref payloads mean replay never needs raw bodies",
        body: "Prompt text, tool arguments, and tool results live in the log only as a DigestRef ({ digest, byteLength, encRef? }); both folds reconstruct the run's shape and outcomes from the log alone, so a trajectory is safe to replay, score, or anchor without ever re-fetching the sensitive content it points at.",
      },
    ],
    faq: [
      {
        question: 'What makes a replay of an AI agent run "deterministic"?',
        answer:
          "The same input events always fold to the same output, no matter what order they arrived in. Caisson's project() sorts every event by seq before folding, and builds the result object in a fixed key order, so JSON.stringify of two projections of the same log is byte-identical.",
      },
      {
        question:
          "Why does replay sort events by seq instead of trusting arrival order?",
        answer:
          "Because a stream can redeliver out of order (a retried batch, a shuffled queue) and the fold has to be a pure function of the log, never of wall-clock or map-iteration order. Sorting by the append-only store's gapless seq first is what makes two replays of the same run always agree.",
      },
      {
        question:
          "Does replay need the raw prompt and tool-call bodies to reconstruct a run?",
        answer:
          "No. Prompt text, tool arguments, and tool results are each carried in the event log only as a DigestRef (a sha256 digest and byte length, never inline) so project() and projectToolCalls fold the step tree, usage totals, and tool outcomes from the log alone, without ever holding the sensitive bodies it points at.",
      },
      {
        question: "Do tool-call events change what project() outputs?",
        answer:
          "No. projectToolCalls is a separate, sibling fold over tool.proposed/approved/denied/result into a scored-consumable list per toolCallId, it doesn't touch project() or RunProjection, so every existing project() input keeps its existing byte-identical output.",
      },
    ],
    sells: {
      edition: "Agentic-Dev",
      ctaLabel: "See how Agentic-Dev replays every governed run byte-for-byte",
      ctaHref: "/agentic-dev",
    },
    related: [
      "agent-trajectory",
      "governed-agents",
      "llm-eval-gate",
      "token-hash-at-rest",
    ],
  },
];

/** Resolve a term's curated `related` slugs against GLOSSARY_TERMS, dropping anything that
 *  doesn't (yet) resolve, a later batch's slug landing early would otherwise 404. */
function resolveRelated(term: GlossaryTerm): GlossaryTerm[] {
  if (!term.related || term.related.length === 0) return [];
  return term.related
    .map((slug) => GLOSSARY_TERMS.find((t) => t.slug === slug))
    .filter((t): t is GlossaryTerm => t !== undefined);
}

/** related-terms, a curated same-cluster link list (Fork D). Rendered as a plain "section" (not
 *  a bespoke component, ADR-0099) so the links read as normal crawlable prose. */
function relatedTermsSection(term: GlossaryTerm): PageSection | undefined {
  const related = resolveRelated(term);
  if (related.length === 0) return undefined;
  return {
    kind: "section",
    title: "See also",
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
      related.map((t, i) =>
        createElement(
          "li",
          {
            key: t.slug,
            style: {
              display: "flex",
              alignItems: "center",
              gap: "var(--cs-space-3)",
            },
          },
          i > 0 &&
            createElement(
              "span",
              { "aria-hidden": true, className: "cs-muted" },
              "·",
            ),
          createElement(
            "a",
            // `.cs-link` (packages/ui base.css, visual-audit remediation) - accent color +
            // underline, never color-alone, so the link reads as clickable at a glance (ids
            // 12b142a42cc26ae0, 250763cdc31a690a). A middot separates adjacent terms so a
            // flex-wrap line break never reads as ambiguous run-on text (id 5bdfaa87d40e655e).
            {
              href: `/glossary/${t.slug}`,
              className: "cs-link",
            },
            t.term,
          ),
        ),
      ),
    ),
  };
}

/** breadcrumbNav, the on-page "Glossary / <term>" trail mirroring the JSON-LD breadcrumb the
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
 * data shape). One CALLER of the generic `<PageSections>` renderer, the standard order lives
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
      // A real `title` (not a bare eyebrow span, visual-audit id 4476f9e39dbf758c) - and no
      // eyebrow here, since the Hero above already carries the page's one deliberate accent
      // slot (DESIGN.md §8; stacking a same-treatment eyebrow on every section down the page
      // was the "4 of 6 sections" consistency bug, ids 51e4212806fd77f4/1e35c8aa0357490f/
      // d8698756ac39b74d/646117e2b08810da/094a40b39f668ad2 across every glossary term page -
      // fixed once here since every term page shares this one builder).
      kind: "section",
      title: "In code",
    },
    {
      kind: "codeArtifact",
      label: term.artifact.label,
      code: term.artifact.code,
    },
    {
      kind: "featureGrid",
      title: "How it holds",
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
