/**
 * NIST SP 800-53 rev5 — the fifth `regimes.ts`-pattern crosswalk (ADR-0363/ADR-0364, the
 * "oscal-spine" SPEC). CLEAN-ROOM, OWN-AUTHORED, checked against the vendored catalog.
 *
 * Unlike the ISO/IEC 27001:2022 crosswalk (`regimes.ts`), there is no pre-existing external OLIR
 * document mapping Caisson's proprietary controls to 800-53 -- these rows are OWN-AUTHORED: each
 * `summary` is an original Caisson paraphrase of the cited 800-53 control's public requirement
 * (NIST SP 800-53 is a U.S. government work; still never copied verbatim here, for the same
 * clean-room discipline every other crosswalk in this file holds to), and every `control` id is
 * checked to exist in the vendored catalog (`../vendor/nist-800-53-rev5-catalog.json`,
 * `crosswalks.test.ts` "every cited 800-53 control id exists" -- an existence test, not a
 * convention). `seedProvenance` pins the vendored catalog itself (the CHECK-DATA source, not a
 * third-party mapping doc) via `NIST_CATALOG_PIN` -- the ONE pin constant, never a second copy.
 *
 * HONEST COVERAGE, NO PADDING: rows exist only where a real, tested Caisson mechanism backs the
 * 800-53 control. Five families dominate because five caisson packages have genuine mechanism
 * backing -- tenancy-rls (AC), audit-worm (AU), field-crypto (SC/SI/MP), auth (IA). CP
 * (Contingency Planning -- system backup/recovery) is DELIBERATELY ABSENT: no caisson package
 * proves a system backup/recovery mechanism (the SOC2 pack's own `AVAILABILITY.BACKUP-RECOVERY`
 * canonical control is prose-only, cited by no existing regime crosswalk's rows either) -- adding
 * a CP row here would be exactly the padding this crosswalk's honesty floor forbids.
 *
 * F2 OLIR VOCABULARY (ADR-0364, verbatim on THIS crosswalk only): every row's `relationship` +
 * `rationale` use NIST IR 8278A's actual set-theory vocabulary (never the 3-way
 * `related|partial|equivalent` enum the other four crosswalks use); `strength` is NIST's own
 * optional 0-10 confidence value.
 *
 * CLAIM CAP (unchanged from the ISO Legal-gate pattern): every row is `claim: "maps-to"` -- no
 * row carries a `proof`, and `RegimeCrosswalkRow` has no `verification` field to carry either, so
 * an 800-53-driven contribution can never promote a rollup cell to `implements` (structural, see
 * `crosswalk-rollup.ts`). `canonicalControlId` is REQUIRED on every row (enforced below, not just
 * by convention) -- every row's purpose IS the join.
 */
import { ValidationError } from "@caisson-sh/kernel";
import {
  defineRegimeCrosswalk,
  type RegimeCrosswalk,
  type RegimeCrosswalkInput,
} from "./regime-crosswalk.ts";
import { NIST_CATALOG_PIN } from "../vendor/nist-catalog-pin.ts";

/** Caisson crosswalk data version — mirrors the other four (`regimes.ts` `CROSSWALK_VERSION`);
 *  kept as its own literal rather than a cross-file import to avoid a circular dependency between
 *  this file and `regimes.ts` (`regimes.ts`'s `regimeCrosswalks` array imports THIS module). */
const CROSSWALK_VERSION = "2026.1";

/**
 * `defineRegimeCrosswalk` only makes `canonicalControlId` OPTIONAL (shared across every regime).
 * This crosswalk's entire purpose is the join, so require it here, fail-closed at module load —
 * the same enforcement moment every other authoring error in this file already fails at.
 */
function defineNist80053Crosswalk(
  input: RegimeCrosswalkInput,
): RegimeCrosswalk {
  const crosswalk = defineRegimeCrosswalk(input);
  for (const row of crosswalk.rows) {
    if (row.canonicalControlId === undefined) {
      throw new ValidationError(
        `nist80053Crosswalk row "${row.control}" is missing a required canonicalControlId`,
      );
    }
  }
  return crosswalk;
}

/**
 * NIST SP 800-53 Revision 5 -- the fifth `regimes.ts`-pattern crosswalk. `canonicalControlId` on
 * every row (ADR-0347 Fork G1 pattern, made REQUIRED here) lets a live collector run light this
 * row in the cross-framework rollup (`compliance-core`'s `computeCrosswalkRollup`, generalized in
 * the same change to loop over every canonicalControlId-carrying regime crosswalk, not just ISO).
 */
export const nist80053Crosswalk: RegimeCrosswalk = defineNist80053Crosswalk({
  regime: "nist-800-53",
  title: "NIST SP 800-53 Revision 5 — Caisson technical-control crosswalk",
  regimeRevision: `NIST SP 800-53 Revision ${NIST_CATALOG_PIN.catalogVersion} (OSCAL v${NIST_CATALOG_PIN.oscalVersion}), vendored from ${NIST_CATALOG_PIN.repo} @ ${NIST_CATALOG_PIN.commitSha.slice(0, 12)}`,
  crosswalkVersion: CROSSWALK_VERSION,
  regimeSpecificDisclaimer:
    "NIST SP 800-53 controls are assessed and authorized against a system's own System Security " +
    "Plan (SSP) — typically through a FedRAMP or agency Authorization to Operate (ATO) process — " +
    "never against a standalone software library. Caisson holds no ATO, is not FedRAMP " +
    "authorized, and makes no claim of FedRAMP readiness or proximity from this crosswalk's mere " +
    "existence. These rows cite bare 800-53 control identifiers as factual references and record " +
    "a functional relationship between a Caisson mechanism and the control's requirement, per " +
    "NIST's own OLIR relationship vocabulary (IR 8278A); authorizing your own system against " +
    "these controls remains between you and your authorizing official or 3PAO.",
  seedProvenance: {
    sourceId: "nist-sp800-53r5-oscal-content-catalog",
    sourceVersion: `NIST SP 800-53 Rev ${NIST_CATALOG_PIN.catalogVersion} (OSCAL v${NIST_CATALOG_PIN.oscalVersion}), vendored @ ${NIST_CATALOG_PIN.commitSha.slice(0, 12)}`,
    sourceUrl: NIST_CATALOG_PIN.sourceUrl,
    sourceDigest: NIST_CATALOG_PIN.sha256,
  },
  rows: [
    // --- AC — Access Control (tenancy-rls) ---------------------------------------------------
    {
      claim: "maps-to",
      control: "AC-3",
      summary:
        "The system enforces approved authorizations for controlling access to information and " +
        "system resources, in accordance with applicable access-control policy.",
      mechanism:
        "@caisson-sh/tenancy-rls — Postgres FORCE ROW LEVEL SECURITY with a fail-closed tenant " +
        "boundary (a missing tenant scope denies as a 404, never widens access).",
      evidence:
        "Tenant-isolation tests and the RLS provisioning generator in packages/tenancy-rls.",
      buyerResponsibility:
        "Access enforcement above the data layer — your application's authorization model, " +
        "API-level permission checks, and any access point outside the database tier.",
      canonicalControlId: "ACCESS-CONTROL.LOGICAL",
      relationship: "subset-of",
      rationale: "functional",
      strength: 6,
    },
    {
      claim: "maps-to",
      control: "AC-6",
      summary:
        "The system is configured to allow only the access necessary to accomplish assigned " +
        "organizational tasks, denying access beyond what a role requires.",
      mechanism:
        "@caisson-sh/tenancy-rls — the fail-closed tenant boundary confines every query to its own " +
        "tenant scope by construction, so a role cannot read or write outside its assigned " +
        "tenant regardless of application-layer bugs.",
      evidence:
        "Tenant-isolation and fail-closed-scope tests in packages/tenancy-rls.",
      buyerResponsibility:
        "Least privilege WITHIN a tenant — your own role/permission model, admin-scope " +
        "restrictions, and periodic access review.",
      canonicalControlId: "ACCESS-CONTROL.LOGICAL",
      relationship: "subset-of",
      rationale: "functional",
      strength: 5,
    },
    // --- AU — Audit and Accountability (audit-worm) ------------------------------------------
    {
      claim: "maps-to",
      control: "AU-2",
      summary:
        "The system identifies the types of events it is capable of logging and generates " +
        "records for the events the organization determines require logging.",
      mechanism:
        "@caisson-sh/audit-worm — an append-only, hash-chained log that durably records the " +
        "security-relevant events routed to it.",
      evidence:
        "The audit chain's append path and integration tests in packages/audit-worm.",
      buyerResponsibility:
        "Deciding which application events are worth logging and routing them into the chain — " +
        "the event-selection policy is yours.",
      canonicalControlId: "AUDIT.IMMUTABLE-LOG",
      relationship: "subset-of",
      rationale: "functional",
      strength: 6,
    },
    {
      claim: "maps-to",
      control: "AU-9",
      summary:
        "Audit information and audit logging tools are protected from unauthorized access, " +
        "modification, and deletion.",
      mechanism:
        "@caisson-sh/audit-worm — the append-only, hash-chained log is verifiable against a " +
        "trusted anchor, so a modification, truncation, or rewrite after the fact is detectable " +
        "rather than silently accepted.",
      evidence: "The tamper-evidence integration tests in packages/audit-worm.",
      buyerResponsibility:
        "A write-once backing store for production (e.g. S3 Object-Lock) is your deployment " +
        "choice; access control on who can read the log is yours.",
      canonicalControlId: "AUDIT.IMMUTABLE-LOG",
      relationship: "intersects-with",
      rationale: "functional",
      strength: 8,
    },
    {
      claim: "maps-to",
      control: "AU-11",
      summary:
        "Audit records are retained for a time period consistent with the organization's " +
        "records-retention policy, to support after-the-fact investigation.",
      mechanism:
        "@caisson-sh/audit-worm — a fail-closed retention floor rejects a retention term " +
        "configured below the minimum, so a retention window cannot be silently shortened.",
      evidence: "Retention-floor tests in packages/audit-worm.",
      buyerResponsibility:
        "Choosing the retention period itself and your storage lifecycle; Caisson enforces " +
        "that your configured floor cannot be undercut, not that any particular duration is " +
        "chosen.",
      canonicalControlId: "AUDIT.IMMUTABLE-LOG",
      relationship: "intersects-with",
      rationale: "functional",
      strength: 7,
    },
    // --- SC — System and Communications Protection (field-crypto) ---------------------------
    {
      claim: "maps-to",
      control: "SC-13",
      summary:
        "The system implements defined cryptographic uses and the types of cryptography " +
        "required for each specified use, per applicable law and policy.",
      mechanism:
        "@caisson-sh/field-crypto — per-field AEAD encryption with a self-describing, rotatable " +
        "key envelope.",
      evidence: "Encryption and key-envelope tests in packages/field-crypto.",
      buyerResponsibility:
        "Selecting which fields carry sensitive data, your key-custody and rotation policy, " +
        "and any cryptography used outside field-crypto (e.g. transport-layer TLS).",
      canonicalControlId: "DATA-PROTECTION.ENCRYPTION",
      relationship: "subset-of",
      rationale: "functional",
      strength: 6,
    },
    {
      claim: "maps-to",
      control: "SC-28",
      summary:
        "The confidentiality and integrity of information at rest is protected.",
      mechanism:
        "@caisson-sh/field-crypto — per-field AEAD encryption at rest with row-bound additional " +
        "authenticated data, so a relocated ciphertext fails authentication rather than " +
        "decrypting under another record.",
      evidence:
        "Cross-row/cross-tenant relocation and tamper-detection tests in packages/field-crypto.",
      buyerResponsibility:
        "Selecting which fields hold sensitive information and your key-custody policy; data " +
        "at rest outside field-crypto-encrypted columns is outside this mechanism.",
      canonicalControlId: "DATA-PROTECTION.ENCRYPTION",
      relationship: "intersects-with",
      rationale: "functional",
      strength: 7,
    },
    // --- SI — System and Information Integrity (alerting, field-crypto) ---------------------
    {
      claim: "maps-to",
      control: "SI-4",
      summary:
        "The system is monitored to detect attacks, indicators of potential attacks, and " +
        "unauthorized connections, and the organization identifies unauthorized use.",
      mechanism:
        "@caisson-sh/alerting — a rule-driven alerting pipeline that raises signals on defined " +
        "conditions drawn from the audit-worm chain and substrate collector facts.",
      evidence: "Alerting pipeline and channel tests in packages/alerting.",
      buyerResponsibility:
        "Deciding what to monitor, defining alert thresholds and routing, and acting on the " +
        "alerts raised — Caisson does not operate a SOC.",
      canonicalControlId: "SYSTEM-OPERATIONS.DETECTION",
      relationship: "subset-of",
      rationale: "functional",
      strength: 4,
    },
    {
      claim: "maps-to",
      control: "SI-7",
      summary:
        "The organization employs integrity-verification tools to detect unauthorized changes " +
        "to information.",
      mechanism:
        "@caisson-sh/field-crypto — row-bound additional authenticated data means a tampered or " +
        "relocated ciphertext fails authentication and is rejected rather than silently " +
        "decrypted.",
      evidence:
        "The encrypt-field tamper-detection tests in packages/field-crypto.",
      buyerResponsibility:
        "Software and firmware integrity (code signing, boot integrity, supply-chain checks) " +
        "is outside field-crypto's scope — it protects stored data, not the running system.",
      canonicalControlId: "DATA-PROTECTION.INTEGRITY",
      relationship: "subset-of",
      rationale: "functional",
      strength: 5,
    },
    // --- IA — Identification and Authentication (auth) --------------------------------------
    {
      claim: "maps-to",
      control: "IA-2",
      summary:
        "The system uniquely identifies and authenticates organizational users (or processes " +
        "acting on their behalf) before granting access.",
      mechanism:
        "@caisson-sh/auth — session and JWT verification gating requests at the application " +
        "boundary before any protected resource is reached.",
      evidence: "JWT/session verification tests in packages/auth.",
      buyerResponsibility:
        "Multi-factor authentication policy, credential lifecycle, and any federation with " +
        "your own identity provider.",
      canonicalControlId: "AUTHENTICATION.ENTITY",
      relationship: "intersects-with",
      rationale: "functional",
      strength: 6,
    },
    // --- MP — Media Protection (field-crypto crypto-shred) -----------------------------------
    {
      claim: "maps-to",
      control: "MP-6",
      summary:
        "Information system media is sanitized prior to disposal, release out of " +
        "organizational control, or release for reuse, using defined sanitization techniques.",
      mechanism:
        "@caisson-sh/field-crypto — crypto-shred destroys a subject's governing key so their " +
        "ciphertext becomes irreversibly unrecoverable, a recognized cryptographic-erasure " +
        "alternative to physical media sanitization, applied selectively and irreversibly.",
      evidence:
        "The crypto-shred tests prove disposal is selective, irreversible, and leaves the " +
        "committed-ciphertext audit chain verifiable.",
      buyerResponsibility:
        "Defining the retention schedule that triggers disposal and identifying which records " +
        "reach end of life (the retention-runner schedules the sweep); sanitizing any media " +
        "outside field-crypto-encrypted storage is yours.",
      canonicalControlId: "DATA-PROTECTION.DISPOSAL",
      relationship: "intersects-with",
      rationale: "functional",
      strength: 7,
    },
  ],
});
