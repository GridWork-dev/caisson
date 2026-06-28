/**
 * SOC 2 — Trust Services Criteria coverage pack (ADR-0057). CLEAN-ROOM, OWN-AUTHORED.
 *
 * Every `statement` and `guidance` string below is original Caisson prose. We do NOT ingest,
 * copy, paraphrase, or transform the AICPA Trust Services Criteria text, the Secure Controls
 * Framework (SCF, CC-BY-ND), or any third-party catalog JSON (TM-J / flag-never-guess). The
 * `crosswalk[].reference` values (e.g. `CC6.1`) are bare requirement IDENTIFIERS — factual
 * citations, not control text — used as pointers from our canonical controls to the external
 * criterion they help satisfy. The official criteria text lives behind the citation, never here.
 *
 * Canonical control ids are framework-agnostic and Caisson-owned, so the same control can be
 * crosswalked from multiple frameworks (see `hipaa-security.ts`). Depends only on the T9 builder.
 */
import { type Framework, defineFramework } from "../registry/control.ts";

/**
 * The SOC 2 Trust Services Criteria pack: own-authored canonical controls mapped to the Common
 * Criteria (CC1–CC9) and the Availability / Confidentiality / Processing-Integrity categories.
 * Built (and validated) at module load via `defineFramework` — an authoring error fails closed here.
 */
export const soc2Tsc: Framework = defineFramework({
  id: "soc2-tsc",
  title: "SOC 2 — Trust Services Criteria",
  version: "2024.1",
  description:
    "Own-authored Trust Services Criteria coverage pack: Common Criteria (CC1–CC9) plus the " +
    "Availability, Confidentiality, and Processing Integrity categories, crosswalked to the " +
    "AICPA criterion identifiers. Control text is clean-room Caisson prose; references are citations.",
  controls: [
    {
      id: "GOVERNANCE.CONTROL-ENVIRONMENT",
      title: "Control environment and commitment to integrity",
      family: "Governance",
      statement:
        "The organization establishes and maintains a documented control environment that sets " +
        "the tone for security: a code of conduct, defined security policies, and management " +
        "accountability for upholding them are in place and reviewed at least annually.",
      guidance:
        "Maintain board-or-owner-approved security policies; record the annual review date and " +
        "approver in the audit chain so the control environment is evidentiable, not asserted.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC1.1" },
        { framework: "SOC2-TSC", reference: "CC1.4" },
      ],
    },
    {
      id: "GOVERNANCE.SECURITY-RESPONSIBILITY",
      title: "Assigned security responsibility and accountability",
      family: "Governance",
      statement:
        "A named individual or role holds documented accountability for the information security " +
        "program, and security responsibilities are assigned across the organization with " +
        "sufficient authority and resources to execute them.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC1.3" },
        {
          framework: "HIPAA-Security",
          reference: "164.308(a)(2)",
          note: "Equivalent assigned-security-responsibility safeguard.",
        },
      ],
    },
    {
      id: "COMMUNICATION.OBJECTIVES",
      title: "Communication of security objectives and responsibilities",
      family: "Communication & Information",
      statement:
        "Security objectives, policies, and individual responsibilities are communicated to " +
        "internal personnel and, where relevant, to external parties; channels exist for " +
        "personnel and third parties to report security concerns.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC2.2" },
        { framework: "SOC2-TSC", reference: "CC2.3" },
      ],
    },
    {
      id: "RISK-MANAGEMENT.ASSESSMENT",
      title: "Risk identification and assessment",
      family: "Risk Management",
      statement:
        "The organization identifies risks to the achievement of its security objectives, " +
        "analyzes them for likelihood and impact, and determines how each risk will be managed; " +
        "the assessment is refreshed on a defined cadence and after significant change.",
      guidance:
        "Tie each assessed risk to a control or an accepted-risk decision; retain the assessment " +
        "and its date as evidence.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC3.1" },
        { framework: "SOC2-TSC", reference: "CC3.2" },
      ],
    },
    {
      id: "RISK-MANAGEMENT.FRAUD",
      title: "Consideration of fraud in risk assessment",
      family: "Risk Management",
      statement:
        "The risk assessment explicitly considers the potential for fraud, including unauthorized " +
        "access, data exfiltration, and abuse of privilege, and the ways such acts could circumvent " +
        "existing controls.",
      crosswalk: [{ framework: "SOC2-TSC", reference: "CC3.3" }],
    },
    {
      id: "MONITORING.CONTROL-EVALUATION",
      title: "Ongoing control monitoring and deficiency remediation",
      family: "Monitoring",
      statement:
        "The organization evaluates whether its controls are present and operating, communicates " +
        "identified deficiencies to those responsible for corrective action, and tracks remediation " +
        "to closure on a defined timeline.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC4.1" },
        { framework: "SOC2-TSC", reference: "CC4.2" },
      ],
    },
    {
      id: "ACCESS-CONTROL.LOGICAL",
      title: "Logical access provisioning and least privilege",
      family: "Access Control",
      statement:
        "Logical access to systems and tenant data is granted through an authorized request, " +
        "provisioned on the principle of least privilege, and recertified periodically; access " +
        "rights are matched to a documented role rather than granted ad hoc.",
      guidance:
        "Enforce tenant isolation at the data layer (fail-closed row-level security) so least " +
        "privilege holds even when an application bug would otherwise widen scope.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC6.1" },
        { framework: "SOC2-TSC", reference: "CC6.2" },
        { framework: "SOC2-TSC", reference: "CC6.3" },
      ],
    },
    {
      id: "ACCESS-CONTROL.MFA",
      title: "Multi-factor authentication for privileged access",
      family: "Access Control",
      statement:
        "Privileged access to production systems and the tenant data plane requires a second " +
        "authentication factor beyond a password; single-factor privileged sessions are denied.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC6.1" },
        {
          framework: "HIPAA-Security",
          reference: "164.312(d)",
          note: "Person-or-entity authentication strengthened by a second factor.",
        },
      ],
    },
    {
      id: "ACCESS-CONTROL.DEPROVISIONING",
      title: "Timely access removal on role change or departure",
      family: "Access Control",
      statement:
        "Access is revoked promptly when a user changes role or leaves, on a defined deadline " +
        "measured from the triggering event; orphaned and shared credentials are prohibited and " +
        "periodically reconciled.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC6.2" },
        { framework: "SOC2-TSC", reference: "CC6.3" },
      ],
    },
    {
      id: "DATA-PROTECTION.ENCRYPTION",
      title: "Encryption of sensitive data at rest and in transit",
      family: "Data Protection",
      statement:
        "Sensitive and confidential data is encrypted at rest and in transit using current, " +
        "industry-accepted algorithms, with keys managed under controlled custody and rotated on a " +
        "defined schedule; plaintext sensitive data is never persisted outside an encrypted column.",
      guidance:
        "Bind ciphertext to its row and tenant (row-scoped AAD) so a relocated ciphertext fails " +
        "authentication rather than decrypting under another record.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC6.1" },
        { framework: "SOC2-TSC", reference: "CC6.7" },
        { framework: "SOC2-TSC", reference: "C1.1" },
      ],
    },
    {
      id: "DATA-PROTECTION.DISPOSAL",
      title: "Secure retention and disposal of confidential data",
      family: "Data Protection",
      statement:
        "Confidential data is retained only as long as required and then disposed of so that it is " +
        "rendered unrecoverable; for encrypted data, destruction of the governing key (crypto-shred) " +
        "is an accepted disposal mechanism.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC6.5" },
        { framework: "SOC2-TSC", reference: "C1.2" },
      ],
    },
    {
      id: "AUDIT.IMMUTABLE-LOG",
      title: "Immutable, hash-chained audit log",
      family: "Audit & Accountability",
      statement:
        "Security-relevant events are written to an append-only, hash-chained log that cannot be " +
        "altered or deleted after the fact; integrity is verifiable against a trusted anchor so " +
        "tampering, truncation, or rewriting is detectable.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC4.1" },
        { framework: "SOC2-TSC", reference: "CC7.2" },
        {
          framework: "HIPAA-Security",
          reference: "164.312(b)",
          note: "Satisfies the audit-controls technical safeguard.",
        },
      ],
    },
    {
      id: "SYSTEM-OPERATIONS.DETECTION",
      title: "Detection and monitoring of anomalies",
      family: "System Operations",
      statement:
        "The organization monitors systems for indicators of compromise and configuration drift, " +
        "and generates alerts on anomalous activity so that potential security events are detected " +
        "rather than discovered after the fact.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC7.1" },
        { framework: "SOC2-TSC", reference: "CC7.2" },
      ],
    },
    {
      id: "INCIDENT-RESPONSE.HANDLING",
      title: "Security incident response and recovery",
      family: "Incident Response",
      statement:
        "A documented procedure governs the identification, containment, eradication, and recovery " +
        "of security incidents, including communication to affected parties; incidents and their " +
        "resolutions are recorded for post-incident review.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "CC7.3" },
        { framework: "SOC2-TSC", reference: "CC7.4" },
        { framework: "SOC2-TSC", reference: "CC7.5" },
      ],
    },
    {
      id: "CHANGE-MANAGEMENT.SDLC",
      title: "Authorized, tested, and reviewed changes",
      family: "Change Management",
      statement:
        "Changes to infrastructure and software are authorized, tested, and reviewed before " +
        "deployment, with segregation between the party that develops a change and the party that " +
        "approves its release to production.",
      crosswalk: [{ framework: "SOC2-TSC", reference: "CC8.1" }],
    },
    {
      id: "VENDOR-MANAGEMENT.THIRD-PARTY",
      title: "Vendor and third-party risk management",
      family: "Vendor Management",
      statement:
        "The organization assesses the security of vendors and subservice organizations that handle " +
        "its data, binds them to security obligations by contract, and monitors their continued " +
        "compliance over the life of the relationship.",
      crosswalk: [{ framework: "SOC2-TSC", reference: "CC9.2" }],
    },
    {
      id: "AVAILABILITY.BACKUP-RECOVERY",
      title: "Backup and recovery capability",
      family: "Availability",
      statement:
        "Data is backed up on a defined schedule and recovery is tested periodically against " +
        "documented recovery objectives, so that the organization can restore service and data " +
        "after a disruptive event.",
      crosswalk: [
        { framework: "SOC2-TSC", reference: "A1.2" },
        { framework: "SOC2-TSC", reference: "A1.3" },
      ],
    },
  ],
});
