/**
 * The three named-regime crosswalks ADR-0277 locks: SOC 2, PCI DSS, GDPR. CLEAN-ROOM, OWN-AUTHORED.
 *
 * Every `summary` is an original Caisson paraphrase of the requirement — we do NOT copy or transform
 * the AICPA Trust Services Criteria, the PCI DSS standard text, or the GDPR articles. The `control`
 * ids are bare regime IDENTIFIERS (factual citations), not the requirement text behind them.
 *
 * HONESTY FLOOR (task binding + ADR-0279): only mechanisms that actually exist in this repo are
 * mapped — audit-worm (WORM + hash chain), field-crypto (encryption + crypto-shred), tenancy-rls
 * (FORCE RLS), retention-runner (erasure), auth, alerting, compliance (impersonation audit). A row is
 * `"implements"` ONLY where a live test in this repo proves the named technical control, and every
 * such row links that test in `proof`; when in doubt the row is `"maps-to"`. Fewer, defensible rows
 * beat broad coverage. The `buyerResponsibility` column (never dropped) carries what Caisson does NOT
 * cover, so the whole document stays at the "maps to / supports" register — never "makes you compliant".
 */
import {
  defineRegimeCrosswalk,
  type RegimeCrosswalk,
} from "./regime-crosswalk.ts";

/** Caisson crosswalk data version — dated, versioned like the framework catalogs (bumped on any edit). */
const CROSSWALK_VERSION = "2026.1";

/**
 * SOC 2 — 2017 Trust Services Criteria (Common Criteria + Confidentiality). Two `implements` rows: the
 * tamper-evident audit log (audit-worm) and confidential-data disposal (field-crypto crypto-shred).
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
        "@caisson/tenancy-rls — Postgres FORCE ROW LEVEL SECURITY with a fail-closed tenant boundary (a missing tenant scope denies as a 404, never widens access).",
      evidence:
        "Tenant-isolation tests and the RLS provisioning generator in packages/tenancy-rls.",
      buyerResponsibility:
        "Your identity provider and user-authentication configuration, network and endpoint controls, the authorization/least-privilege model above the data layer, and periodic access recertification.",
    },
    {
      claim: "maps-to",
      control: "CC6.6",
      summary:
        "Access from outside the system boundary is authenticated before protected resources are reached.",
      mechanism:
        "@caisson/auth — session and JWT verification (built-auth integration) gating requests at the application boundary.",
      evidence: "JWT/session verification tests in packages/auth.",
      buyerResponsibility:
        "Multi-factor authentication policy, network boundary and WAF/firewall controls, credential lifecycle, and any federation with your own IdP.",
    },
    {
      claim: "maps-to",
      control: "CC7.1",
      summary:
        "The system is monitored to detect anomalies, configuration drift, and new vulnerabilities.",
      mechanism:
        "@caisson/alerting — a rule-driven alerting pipeline that raises signals on defined conditions.",
      evidence: "Alerting pipeline and channel tests in packages/alerting.",
      buyerResponsibility:
        "Deciding what to monitor, defining alert thresholds and routing, vulnerability scanning of your own deployment, and acting on the alerts raised.",
    },
    {
      claim: "implements",
      control: "CC7.2",
      summary:
        "Security-relevant events are recorded in a log that cannot be altered or deleted after the fact.",
      mechanism:
        "@caisson/audit-worm — an append-only, hash-chained audit log anchored to a trusted tip, so interior tampering, tail truncation, and same-length rewrites are all detected.",
      evidence:
        "The tamper-evidence integration tests prove a broken chain is caught at the tampered index and that the WORM anchor outlives a dropped tail.",
      buyerResponsibility:
        "Emitting the security-relevant events your system generates into the log, and your log-review cadence and monitoring process.",
      proof: {
        kind: "test",
        path: "packages/audit-worm/src/chain-store.integration.test.ts",
        note: "tamper evidence: interior tamper, tail truncation, and same-root rewrite are all caught by the trusted tip.",
      },
    },
    {
      claim: "maps-to",
      control: "C1.1",
      summary:
        "Confidential information is protected against unauthorized access throughout its lifecycle.",
      mechanism:
        "@caisson/field-crypto — per-field AEAD encryption at rest with row-bound additional authenticated data, so a relocated ciphertext fails authentication rather than decrypting elsewhere.",
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
        "@caisson/field-crypto — crypto-shred renders a subject's ciphertext irreversibly unrecoverable by destroying its governing key, selectively (other subjects still decrypt) and irreversibly (re-provisioning a shredded scope is refused), while the append-only audit chain still verifies over the committed ciphertext.",
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
        "@caisson/field-crypto — per-field AEAD encryption at rest with row-bound AAD and a self-describing, rotatable key envelope.",
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
        "@caisson/tenancy-rls — fail-closed FORCE ROW LEVEL SECURITY enforcing the tenant boundary at the data layer.",
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
        "@caisson/auth — session and JWT verification gating access at the application boundary.",
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
        "@caisson/audit-worm — the append-only audit chain is the durable, tamper-evident sink those events are written to.",
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
        "@caisson/audit-worm — an append-only, hash-chained log anchored to a trusted tip, backed by write-once WORM object storage (a conditional GOVERNANCE Object-Lock write; a re-lock of an existing key fails as an existence conflict).",
      evidence:
        "The tamper-evidence integration tests prove modification, truncation, and rewrite are all detected against the trusted tip.",
      buyerResponsibility:
        "Routing your cardholder-data-environment audit events into the store, and your log-review process. Object-Lock retention on your bucket must be configured per your policy.",
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
        "@caisson/audit-worm — a fail-closed retention floor: a retain term below the configured minimum is rejected and never auto-extended, so a retention window cannot be silently shortened.",
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
        "@caisson/retention-runner — scheduled, per-target erasure sweeps, backed by the audit-worm retention floor that prevents a window from being silently shortened.",
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
        "@caisson/audit-worm — a tamper-evident, hash-chained record, exportable through the signed evidence pack (OSCAL) as demonstrable evidence.",
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
        "@caisson/field-crypto — crypto-shred destroys a subject's governing key so their ciphertext is irreversibly unrecoverable, selectively (other subjects still decrypt) and irreversibly (re-provisioning a shredded scope is refused); @caisson/retention-runner drives the sweep and writes a reason-tagged audit row per run.",
      evidence:
        "The crypto-shred tests prove selective, irreversible erasure with a PII-free audit record; the retention-runner tests prove per-target isolation and one audit row per run.",
      buyerResponsibility:
        "Identifying the data subject's records, honoring the Art. 17(3) exemptions (legal obligation, freedom of expression, etc.), verifying the request, and triggering the erasure.",
      proof: {
        kind: "test",
        path: "packages/field-crypto/src/crypto-shred.test.ts",
        note: "crypto-shred renders ciphertext unrecoverable, selectively and irreversibly; the audit payload commits the fact of erasure with no PII.",
      },
    },
    {
      claim: "maps-to",
      control: "Art. 25",
      summary:
        "Data protection is built into processing by design and applied by default.",
      mechanism:
        "The compliance bundle's composition — fail-closed tenant RLS (@caisson/tenancy-rls), field-level encryption (@caisson/field-crypto), and an append-only audit chain (@caisson/audit-worm) — provides data-protection-by-design mechanisms.",
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
        "@caisson/audit-worm — the immutable activity chain contributes evidence toward the processing record.",
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
        "@caisson/field-crypto — per-field AEAD encryption of personal data at rest, bound to its tenant/column/row by additional authenticated data, so a relocated or cross-tenant ciphertext fails to authenticate and an old key version still decrypts after rotation.",
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
        "@caisson/tenancy-rls — fail-closed FORCE ROW LEVEL SECURITY isolating each tenant's data at the database layer.",
      evidence: "The force-RLS and tenant-guard tests in packages/tenancy-rls.",
      buyerResponsibility:
        "The full confidentiality/integrity/availability/resilience posture Art. 32(1)(b)–(c) require — availability and disaster recovery, resilience, and the regular testing of your measures under Art. 32(1)(d).",
    },
  ],
});

/** All three regime crosswalks, for iteration in tests and by a consumer that exports the whole set. */
export const regimeCrosswalks: readonly RegimeCrosswalk[] = [
  soc2Crosswalk,
  pciDssCrosswalk,
  gdprCrosswalk,
];
