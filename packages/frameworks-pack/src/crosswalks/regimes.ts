/**
 * The five named-regime crosswalks: SOC 2, PCI DSS, and GDPR (ADR-0277), ISO/IEC 27001:2022
 * (ADR-0333/ADR-0347, added as a fourth `regimes.ts`-pattern crosswalk), and NIST SP 800-53 rev5
 * (ADR-0363/ADR-0364, added as a fifth — authored in the sibling `nist-800-53.ts`, re-exported
 * here into the shared `regimeCrosswalks` array). CLEAN-ROOM, OWN-AUTHORED.
 *
 * Every `summary` is an original Caisson paraphrase of the requirement — we do NOT copy or transform
 * the AICPA Trust Services Criteria, the PCI DSS standard text, the GDPR articles, or the ISO/IEC
 * 27001:2022 Annex A control text. The `control` ids are bare regime IDENTIFIERS (factual citations),
 * not the requirement text behind them.
 *
 * HONESTY FLOOR (task binding + ADR-0279): only mechanisms that actually exist in this repo are
 * mapped — audit-worm (WORM + hash chain), field-crypto (encryption + crypto-shred), tenancy-rls
 * (FORCE RLS), retention-runner (erasure), auth, alerting, compliance (impersonation audit). A row is
 * `"implements"` ONLY where a live test in this repo proves the named technical control, and every
 * such row links that test in `proof`; when in doubt the row is `"maps-to"`. Fewer, defensible rows
 * beat broad coverage. The `buyerResponsibility` column (never dropped) carries what Caisson does NOT
 * cover, so the whole document stays at the "maps to / supports" register — never "makes you compliant".
 *
 * ISO/IEC 27001:2022 LEGAL GATE (ADR-0333, absolute for v1): every `iso27001Crosswalk` row is
 * `claim: "maps-to"` -- never `"implements"`, never `expert-reviewed` -- pending the ADR-0319 legal
 * answer on the ISO identifier / EU database-right question. Each row's `canonicalControlId`
 * (ADR-0347 Fork G1) lets a live collector pass light the row in the cross-framework rollup
 * (`compliance-core`'s `computeCrosswalkRollup`) through the SAME join the framework packs use --
 * the Legal gate still caps the resulting cell at `maps-to` (enforced structurally in the rollup,
 * not merely by convention here). `iso27001Crosswalk.seedProvenance` (ADR-0347 Fork G2) pins the
 * NIST OLIR **2022-edition** SP 800-53 Rev 5 <-> ISO/IEC 27001:2022 mapping (CSRC catalog
 * `referenceId=155`) this crosswalk was CHECKED against -- CHECK DATA ONLY: the xlsx's own
 * requirement-text columns are never read into this file, only its identifier-pair rows (e.g.
 * `SC-13 -> A.8.24`), per the ADR-0057/ADR-0333 licensing floor. The retired 2013-edition mapping
 * (a `.docx` target) is NEVER used -- see ADR-0333 "Rejected".
 */
import {
  defineRegimeCrosswalk,
  type RegimeCrosswalk,
  nist80053Crosswalk,
} from "@caisson-sh/oscal-spine/browser";

/** Caisson crosswalk data version — dated, versioned like the framework catalogs (bumped on any edit). */
const CROSSWALK_VERSION = "2026.1";

/**
 * SOC 2 — 2017 Trust Services Criteria (Common Criteria + Confidentiality). One `implements` row:
 * confidential-data disposal (field-crypto crypto-shred).
 */
export const soc2Crosswalk: RegimeCrosswalk = defineRegimeCrosswalk({
  regime: "soc2",
  title: "SOC 2 Trust Services Criteria — Caisson technical-control crosswalk",
  regimeRevision:
    "SOC 2 — 2017 Trust Services Criteria (with the 2022 revised points of focus)",
  crosswalkVersion: CROSSWALK_VERSION,
  regimeSpecificDisclaimer:
    "SOC 2 is an attestation, not a certification — no entity is 'SOC 2 certified.' Caisson holds no " +
    "SOC 2 report on itself and displays no AICPA logo. This crosswalk maps the technical controls the " +
    "CC-series criteria call for; the examination of your system remains between you and your CPA firm.",
  rows: [
    {
      claim: "maps-to",
      control: "CC6.1",
      summary:
        "Logical access to protected information assets is restricted to authorized users and processes.",
      mechanism:
        "@caisson-sh/tenancy-rls — Postgres FORCE ROW LEVEL SECURITY with a fail-closed tenant boundary (a missing tenant scope denies as a 404, never widens access).",
      evidence:
        "Tenant-isolation tests and the RLS provisioning generator in packages/tenancy-rls.",
      buyerResponsibility:
        "Your identity provider and user-authentication configuration, network and endpoint controls, the authorization/least-privilege model above the data layer, and periodic access recertification.",
    },
    {
      claim: "maps-to",
      control: "CC6.6",
      summary:
        "The entity implements logical access security measures to protect the system against threats from sources outside its boundaries, including authenticating external access before protected resources are reached.",
      mechanism:
        "@caisson-sh/auth — session and JWT verification (built-auth integration) gating requests at the application boundary.",
      evidence: "JWT/session verification tests in packages/auth.",
      buyerResponsibility:
        "Multi-factor authentication policy, network boundary and WAF/firewall controls, credential lifecycle, and any federation with your own IdP.",
    },
    {
      claim: "maps-to",
      control: "CC7.1",
      summary:
        "The entity uses detection and monitoring procedures to identify configuration changes that introduce new vulnerabilities and susceptibility to newly discovered vulnerabilities.",
      mechanism:
        "@caisson-sh/alerting — a rule-driven alerting pipeline that raises signals on defined conditions.",
      evidence: "Alerting pipeline and channel tests in packages/alerting.",
      buyerResponsibility:
        "Deciding what to monitor, defining alert thresholds and routing, vulnerability scanning of your own deployment, and acting on the alerts raised.",
    },
    {
      claim: "maps-to",
      control: "CC7.2",
      summary:
        "The entity monitors system components and their operation for anomalies indicative of malicious acts, natural disasters, and errors, and analyzes anomalies to determine whether they represent security events.",
      mechanism:
        "@caisson-sh/audit-worm provides the tamper-evident, hash-chained record a monitoring and anomaly-analysis program draws on; @caisson-sh/alerting can raise signals against events written to it. Neither package performs the anomaly analysis itself.",
      evidence:
        "The audit chain in packages/audit-worm and the alerting pipeline in packages/alerting.",
      buyerResponsibility:
        "Building and operating the actual monitoring and anomaly-analysis program: defining what counts as an anomaly, analyzing events for security significance, and configuring and reviewing alerting rules.",
    },
    {
      claim: "maps-to",
      control: "C1.1",
      summary:
        "The entity identifies and maintains confidential information to meet its confidentiality objectives — classifying what counts as confidential and safeguarding it appropriately.",
      mechanism:
        "@caisson-sh/field-crypto — per-field AEAD encryption at rest with row-bound additional authenticated data safeguards confidential fields once identified; a relocated ciphertext fails authentication rather than decrypting elsewhere.",
      evidence:
        "Row-bound encryption tests in packages/field-crypto (encrypt-field, envelope, isolation).",
      buyerResponsibility:
        "Classifying which data is confidential, selecting which columns are encrypted, and your key-custody and rotation policy.",
    },
    {
      claim: "implements",
      control: "C1.2",
      summary:
        "Confidential information is disposed of so that it can no longer be recovered.",
      mechanism:
        "@caisson-sh/field-crypto — crypto-shred renders a subject's ciphertext irreversibly unrecoverable by destroying its governing key, selectively (other subjects still decrypt) and irreversibly (re-provisioning a shredded scope is refused), while the append-only audit chain still verifies over the committed ciphertext.",
      evidence:
        "The crypto-shred tests prove ciphertext becomes unrecoverable, the disposal is selective and irreversible, and the audit record commits the fact of erasure with no PII.",
      buyerResponsibility:
        "Defining the retention schedule that triggers disposal, and identifying which records reach end-of-life (the retention-runner schedules the sweep).",
      proof: {
        kind: "test",
        path: "packages/field-crypto/src/crypto-shred.test.ts",
        note: "crypto-shred is selective, irreversible, and leaves the committed-ciphertext chain verifiable.",
      },
    },
  ],
});

/**
 * PCI DSS v4.0.1 — the requirements Caisson's mechanisms genuinely address (encryption, access
 * control, audit logging, retention). One `implements` row: audit-log tamper protection (audit-worm).
 * Conservative throughout — Caisson is not payment software and is not eligible for PCI SSC validation.
 */
export const pciDssCrosswalk: RegimeCrosswalk = defineRegimeCrosswalk({
  regime: "pci-dss",
  title: "PCI DSS — Caisson technical-control crosswalk",
  regimeRevision: "PCI DSS v4.0.1 (2024)",
  crosswalkVersion: CROSSWALK_VERSION,
  regimeSpecificDisclaimer:
    "Use of these mechanisms may help support the security of your cardholder data environment, but " +
    "does not make your organization PCI DSS compliant. Caisson is not payment software, stores no " +
    "cardholder data itself, and is not eligible for any PCI SSC validation track; your environment is " +
    "validated by a QSA or a self-assessment questionnaire, never by this crosswalk.",
  rows: [
    {
      claim: "maps-to",
      control: "Req 3.5.1",
      summary:
        "Stored account data is rendered unreadable wherever it is stored, using strong cryptography.",
      mechanism:
        "@caisson-sh/field-crypto — per-field AEAD encryption at rest with row-bound AAD and a self-describing, rotatable key envelope.",
      evidence: "Encryption and key-envelope tests in packages/field-crypto.",
      buyerResponsibility:
        "Caisson stores no cardholder data — you scope your cardholder data environment, apply field-crypto to the PAN columns, and run key management per Req 3.6/3.7. Truncation, hashing, or tokenization of the PAN where used are your choices.",
    },
    {
      claim: "maps-to",
      control: "Req 7.2.1",
      summary:
        "Access is assigned on need-to-know and least privilege through a defined access-control model.",
      mechanism:
        "@caisson-sh/tenancy-rls — fail-closed FORCE ROW LEVEL SECURITY enforcing the tenant boundary at the data layer.",
      evidence: "RLS force-enforcement tests in packages/tenancy-rls.",
      buyerResponsibility:
        "Defining roles and privileges for your environment, the approval workflow, and periodic access reviews (Req 7.2.4).",
    },
    {
      claim: "maps-to",
      control: "Req 8.3.1",
      summary:
        "Access is authenticated with at least one strong authentication factor before it is granted.",
      mechanism:
        "@caisson-sh/auth — session and JWT verification gating access at the application boundary.",
      evidence: "JWT/session verification tests in packages/auth.",
      buyerResponsibility:
        "Multi-factor authentication into the cardholder data environment (Req 8.4/8.5), credential and password policy, and account lifecycle management.",
    },
    {
      claim: "maps-to",
      control: "Req 10.2.1",
      summary:
        "Audit logs capture the events needed to reconstruct who did what to in-scope systems.",
      mechanism:
        "@caisson-sh/audit-worm — the append-only audit chain is the durable, tamper-evident sink those events are written to.",
      evidence:
        "Append/anchor/verify integration tests in packages/audit-worm.",
      buyerResponsibility:
        "Emitting the specific events Req 10.2 enumerates (access to cardholder data, privileged actions, log-access, etc.) from your systems into the log — the event coverage is yours.",
    },
    {
      claim: "implements",
      control: "Req 10.3.2",
      summary:
        "Audit log files are protected so that they cannot be modified after they are written.",
      mechanism:
        "@caisson-sh/audit-worm — an append-only, hash-chained log anchored to a trusted tip, so modification, truncation, or rewriting after the fact is detectable; production deployments back the log with a write-once object store (e.g. S3 Object-Lock in GOVERNANCE mode).",
      evidence:
        "The tamper-evidence integration tests prove modification, truncation, and rewrite are all detected against the trusted tip.",
      buyerResponsibility:
        "Routing your cardholder-data-environment audit events into the store, and your log-review process. Configuring and retaining a write-once backing store (e.g. Object-Lock retention on your bucket) is your deployment choice.",
      proof: {
        kind: "test",
        path: "packages/audit-worm/src/chain-store.integration.test.ts",
        note: "interior tamper, tail truncation, and same-root rewrite are caught by the trusted tip.",
      },
    },
    {
      claim: "maps-to",
      control: "Req 10.5.1",
      summary:
        "Audit trail history is retained for at least twelve months, with recent history readily available.",
      mechanism:
        "@caisson-sh/audit-worm — a fail-closed retention floor: a retain term below the configured minimum is rejected and never auto-extended, so a retention window cannot be silently shortened.",
      evidence:
        "Retention-floor tests in packages/audit-worm (a term below the floor fails closed).",
      buyerResponsibility:
        "Configuring the twelve-month retention term (Caisson enforces that it cannot be shortened below your floor, not that any particular duration is chosen) and your storage lifecycle.",
    },
  ],
});

/**
 * GDPR — Regulation (EU) 2016/679 (the Art. 5 / 17 / 25 / 30 / 32 technical-measures cluster). Two
 * `implements` rows: the right to erasure (crypto-shred) and encryption of personal data (field-crypto).
 */
export const gdprCrosswalk: RegimeCrosswalk = defineRegimeCrosswalk({
  regime: "gdpr",
  title: "GDPR — Caisson technical-measures crosswalk",
  regimeRevision: "GDPR — Regulation (EU) 2016/679",
  crosswalkVersion: CROSSWALK_VERSION,
  regimeSpecificDisclaimer:
    "Under the EDPB's guidance a standalone software product cannot be GDPR-certified — certification " +
    "applies to a controller's or processor's processing operations, not to a shipped library. Caisson " +
    "provides mechanisms that help you, as controller or processor, meet obligations that fall on you; " +
    "'GDPR compliant' is never claimed for Caisson or any module.",
  rows: [
    {
      claim: "maps-to",
      control: "Art. 5(1)(e)",
      summary:
        "Personal data is kept in identifiable form no longer than necessary for the purpose (storage limitation).",
      mechanism:
        "@caisson-sh/retention-runner — scheduled, per-target erasure sweeps, backed by the audit-worm retention floor that prevents a window from being silently shortened.",
      evidence: "Erasure-run and schedule tests in packages/retention-runner.",
      buyerResponsibility:
        "Defining the retention periods and lawful basis for each data category, and which records are in scope for erasure.",
    },
    {
      claim: "maps-to",
      control: "Art. 5(2)",
      summary:
        "The controller can demonstrate compliance with the data-protection principles (accountability).",
      mechanism:
        "@caisson-sh/audit-worm — a tamper-evident, hash-chained record, exportable through the signed evidence pack (OSCAL) as demonstrable evidence.",
      evidence:
        "The audit chain plus the compliance-bundle evidence-pack export.",
      buyerResponsibility:
        "The accountability record for YOUR processing — your policies, DPIAs, lawful-basis documentation, and the demonstration itself to a supervisory authority.",
    },
    {
      claim: "implements",
      control: "Art. 17",
      summary:
        "A data subject can obtain erasure of their personal data (the right to be forgotten).",
      mechanism:
        "@caisson-sh/field-crypto — crypto-shred destroys a subject's governing key so their ciphertext is irreversibly unrecoverable, selectively (other subjects still decrypt) and irreversibly (re-provisioning a shredded scope is refused); @caisson-sh/retention-runner schedules the erasure sweep across targets.",
      evidence:
        "The crypto-shred tests prove the field-level erasure primitive is selective, irreversible, and produces a PII-free audit record.",
      buyerResponsibility:
        "Identifying the data subject's records, honoring the Art. 17(3) exemptions (legal obligation, freedom of expression, etc.), verifying the request, triggering the erasure, and covering any personal data your system holds outside field-crypto-encrypted columns.",
      proof: {
        kind: "test",
        path: "packages/field-crypto/src/crypto-shred.test.ts",
        note: "crypto-shred is selective, irreversible, and leaves a PII-free audit record — the field-level erasure primitive Art. 17 depends on.",
      },
    },
    {
      claim: "maps-to",
      control: "Art. 25",
      summary:
        "Data protection is built into processing by design and applied by default.",
      mechanism:
        "The compliance bundle's composition — fail-closed tenant RLS (@caisson-sh/tenancy-rls), field-level encryption (@caisson-sh/field-crypto), and an append-only audit chain (@caisson-sh/audit-worm) — provides data-protection-by-design mechanisms.",
      evidence: "The tenancy-rls, field-crypto, and audit-worm test suites.",
      buyerResponsibility:
        "The design decisions for your processing: your DPIA, the default settings you choose, data minimization, and the technical-and-organizational-measures assessment for your system.",
    },
    {
      claim: "maps-to",
      control: "Art. 30",
      summary:
        "The controller or processor maintains a record of its processing activities.",
      mechanism:
        "@caisson-sh/audit-worm — the immutable activity chain contributes evidence toward the processing record.",
      evidence: "The audit chain and its verify path in packages/audit-worm.",
      buyerResponsibility:
        "Maintaining the Article 30 register itself — purposes of processing, categories of data and recipients, transfers, and retention — which is your documentation duty, not a Caisson artifact.",
    },
    {
      claim: "implements",
      control: "Art. 32(1)(a)",
      summary:
        "Personal data is protected by appropriate measures including pseudonymization and encryption.",
      mechanism:
        "@caisson-sh/field-crypto — per-field AEAD encryption of personal data at rest, bound to its tenant/column/row by additional authenticated data, so a relocated or cross-tenant ciphertext fails to authenticate and an old key version still decrypts after rotation.",
      evidence:
        "The encrypt-field tests prove round-trip encryption plus cross-row, cross-column, and cross-tenant relocation failures and tamper detection.",
      buyerResponsibility:
        "Selecting which fields hold personal data and are encrypted, your key-custody and rotation policy, and encryption in transit (TLS) at your boundary.",
      proof: {
        kind: "test",
        path: "packages/field-crypto/src/encrypt-field.test.ts",
        note: "row-bound AAD: cross-row, cross-column, and cross-tenant relocations fail to authenticate; a tampered envelope is rejected.",
      },
    },
    {
      claim: "maps-to",
      control: "Art. 32(1)(b)",
      summary:
        "Processing systems maintain the ongoing confidentiality of personal data.",
      mechanism:
        "@caisson-sh/tenancy-rls — fail-closed FORCE ROW LEVEL SECURITY isolating each tenant's data at the database layer.",
      evidence: "The force-RLS and tenant-guard tests in packages/tenancy-rls.",
      buyerResponsibility:
        "The full confidentiality/integrity/availability/resilience posture Art. 32(1)(b)–(c) require — availability and disaster recovery, resilience, and the regular testing of your measures under Art. 32(1)(d).",
    },
  ],
});

/**
 * ISO/IEC 27001:2022 Annex A -- the fourth `regimes.ts`-pattern crosswalk (ADR-0333/ADR-0347).
 * Every row is own-authored paraphrase over a bare Annex A identifier (never Annex A text), and
 * every row is capped `claim: "maps-to"` by the Legal gate (ADR-0333) -- no exceptions in v1.
 * `canonicalControlId` on each row (ADR-0347 Fork G1) points at a REAL canonical control already
 * crosswalked from the shipped SOC2/HIPAA/EU-AI-Act packs, so a live collector run that evidences
 * that control also lights this ISO row in the cross-framework rollup. Each id pairing below was
 * CHECKED (identifiers only, never text) against the pinned OLIR 2022-edition mapping's own
 * SP 800-53 <-> ISO/IEC 27001:2022 rows (`seedProvenance` below) -- e.g. the mapping's own
 * `SC-13 -> A.8.24` and `MP-06 -> A.8.10` rows back the encryption and disposal pairings here.
 */
export const iso27001Crosswalk: RegimeCrosswalk = defineRegimeCrosswalk({
  regime: "iso-27001",
  title: "ISO/IEC 27001:2022 Annex A — Caisson technical-control crosswalk",
  regimeRevision: "ISO/IEC 27001:2022 (Annex A, per ISO/IEC 27002:2022)",
  crosswalkVersion: CROSSWALK_VERSION,
  regimeSpecificDisclaimer:
    "Under ISO/IEC 27001, certification applies to an organization's information security " +
    "management system (ISMS) — a documented, audited program run BY an organization — never to a " +
    "standalone software product. Caisson holds no ISO/IEC 27001 certificate and is not 'ISO " +
    "certified'; this crosswalk cites bare Annex A control identifiers as factual references and " +
    "maps the technical controls they call for. Establishing, operating, and certifying your own " +
    "ISMS remains between you and your accredited certification body.",
  seedProvenance: {
    sourceId: "nist-sp800-53r5-iso27001-2022-olir",
    sourceVersion:
      "NIST OLIR v1.0.0, posted 2023-11-13 (focal document SP 800-53 Rev 5.1.1)",
    sourceUrl:
      "https://csrc.nist.gov/csrc/media/Projects/olir/documents/submissions/sp800-53r5-to-iso-27001-mapping-2022-OLIR-2023-10-12-UPDATED.xlsx",
    sourceDigest:
      "e631de234a1fac057991773f015c221226940540f5602e1b70a3768eaff5cbd9",
  },
  rows: [
    {
      claim: "maps-to",
      control: "A.5.15",
      summary:
        "Logical and physical access to information and other associated assets is governed by " +
        "rules derived from business and security requirements.",
      mechanism:
        "@caisson-sh/tenancy-rls — Postgres FORCE ROW LEVEL SECURITY with a fail-closed tenant boundary " +
        "(a missing tenant scope denies as a 404, never widens access).",
      evidence:
        "Tenant-isolation tests and the RLS provisioning generator in packages/tenancy-rls.",
      buyerResponsibility:
        "Your identity provider and user-authentication configuration, the authorization/" +
        "least-privilege model above the data layer, and periodic access recertification.",
      canonicalControlId: "ACCESS-CONTROL.LOGICAL",
    },
    {
      claim: "maps-to",
      control: "A.8.24",
      summary:
        "The use of cryptography to protect information is governed by defined rules, including key " +
        "management practices.",
      mechanism:
        "@caisson-sh/field-crypto — per-field AEAD encryption at rest with row-bound additional " +
        "authenticated data, plus a self-describing, rotatable key envelope.",
      evidence: "Encryption and key-envelope tests in packages/field-crypto.",
      buyerResponsibility:
        "Selecting which fields hold sensitive information, your key-custody and rotation policy, " +
        "and encryption in transit at your own network boundary.",
      canonicalControlId: "DATA-PROTECTION.ENCRYPTION",
    },
    {
      claim: "maps-to",
      control: "A.8.10",
      summary:
        "Information held in systems, devices, or storage media is deleted once it is no longer " +
        "required, so it cannot be recovered.",
      mechanism:
        "@caisson-sh/field-crypto — crypto-shred renders a subject's ciphertext irreversibly " +
        "unrecoverable by destroying its governing key, selectively (other subjects still decrypt) " +
        "and irreversibly (a shredded scope cannot be re-provisioned).",
      evidence:
        "The crypto-shred tests prove disposal is selective, irreversible, and leaves the " +
        "committed-ciphertext audit chain verifiable.",
      buyerResponsibility:
        "Defining the retention schedule that triggers disposal, and identifying which records " +
        "reach end of life (the retention-runner schedules the sweep).",
      canonicalControlId: "DATA-PROTECTION.DISPOSAL",
    },
    {
      claim: "maps-to",
      control: "A.8.15",
      summary:
        "Activity logs are produced, retained, and protected from unauthorized access or " +
        "alteration so that events remain reviewable.",
      mechanism:
        "@caisson-sh/audit-worm — an append-only, hash-chained log verifiable against a trusted " +
        "anchor, so tampering, truncation, or rewriting after the fact is detectable.",
      evidence: "The tamper-evidence integration tests in packages/audit-worm.",
      buyerResponsibility:
        "Deciding which application events are written to the log and your own log-review " +
        "process; a write-once backing store for production is your deployment choice.",
      canonicalControlId: "AUDIT.IMMUTABLE-LOG",
    },
    {
      claim: "maps-to",
      control: "A.8.16",
      summary:
        "Systems are monitored for anomalous behavior so that potential security events are " +
        "identified and can be acted on.",
      mechanism:
        "@caisson-sh/alerting — a rule-driven alerting pipeline that raises signals on defined " +
        "conditions, drawing on the audit-worm chain and substrate collector facts.",
      evidence: "Alerting pipeline and channel tests in packages/alerting.",
      buyerResponsibility:
        "Deciding what to monitor, defining alert thresholds and routing, and acting on the " +
        "alerts raised.",
      canonicalControlId: "SYSTEM-OPERATIONS.DETECTION",
    },
    {
      claim: "maps-to",
      control: "A.8.5",
      summary:
        "Access is granted only after a secure authentication procedure verifies the identity of " +
        "the person or entity requesting it.",
      mechanism:
        "@caisson-sh/auth — session and JWT verification gating requests at the application " +
        "boundary before any protected resource is reached.",
      evidence: "JWT/session verification tests in packages/auth.",
      buyerResponsibility:
        "Multi-factor authentication policy, credential lifecycle, and any federation with your " +
        "own identity provider.",
      canonicalControlId: "AUTHENTICATION.ENTITY",
    },
    {
      claim: "maps-to",
      control: "A.5.37",
      summary:
        "Operating procedures and records for information-security-relevant processes are " +
        "documented, retained, and made available to those who need them.",
      mechanism:
        "@caisson-sh/audit-worm — a fail-closed retention floor rejects a retention term configured " +
        "below the minimum, so operating records and documentation are not disposed of early.",
      evidence: "Retention-floor tests in packages/audit-worm.",
      buyerResponsibility:
        "Authoring and maintaining the operating procedures themselves; Caisson enforces that " +
        "your configured retention floor cannot be silently shortened, not that any particular " +
        "procedure exists.",
      canonicalControlId: "GOVERNANCE.DOCUMENTATION",
    },
  ],
});

/** All five regime crosswalks, for iteration in tests and by a consumer that exports the whole set. */
export const regimeCrosswalks: readonly RegimeCrosswalk[] = [
  soc2Crosswalk,
  pciDssCrosswalk,
  gdprCrosswalk,
  iso27001Crosswalk,
  nist80053Crosswalk,
];
