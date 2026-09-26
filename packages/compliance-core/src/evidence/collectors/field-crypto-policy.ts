// src/evidence/collectors/field-crypto-policy.ts — PHI encryption-at-rest evidence (ADR-0058, ADR-0181,
// ADR-0043/0046). HIPAA Technical Safeguard §164.312(a)(2)(iv)/(e)(2)(ii): PHI is encrypted at rest.
//
// Composes `@caisson-sh/field-crypto`'s `parseEnvelope` VERBATIM (mirroring how chain-verify composes the
// kernel's `verifyChain`) over per-PHI-field at-rest samples gathered TENANT-SCOPED at the edge (a read
// inside `withTenantCrypto`, so the sample never crosses a tenant boundary). The collector adds no
// crypto; it turns the envelope verdict into evidence. Fail-closed / flag-never-guess (ADR-0058):
//   - no PHI fields inspected → `unresolved` (encryption posture cannot be attested);
//   - any field whose stored value is NOT a valid AES-256-GCM field-crypto envelope (plaintext, a wrong
//     algorithm, or a corrupt/unknown format) → `flagged` — a real deficiency (PHI not encrypted at rest);
//   - a field with no populated row to sample (evidence absent) → `unresolved`; refuse to guess a pass.
import { ALG_AES_256_GCM, parseEnvelope } from "@caisson-sh/field-crypto";
import {
  flaggedResult,
  passResult,
  unresolvedResult,
  type CollectorResult,
  type EvidenceCollector,
  type ManualAttachmentSlot,
} from "../collector.ts";

/** One PHI-bearing field's at-rest state, gathered tenant-scoped at the edge. */
export interface PhiFieldFact {
  /** The tenant-scoped column this PHI lives in (e.g. `"patient.ssn"`). */
  readonly field: string;
  /**
   * A sample of the value as stored at rest (the base64 field-crypto envelope), or `null` when the
   * field has no populated row to inspect — evidence absent, not proof of anything.
   */
  readonly storedValue: string | null;
}

/** The base fact: the at-rest state across every PHI-bearing field in scope for the tenant. */
export interface FieldCryptoPolicyFact {
  readonly fields: readonly PhiFieldFact[];
}

export interface FieldCryptoPolicyCollectorOptions {
  /** The canonical control id this evidences; defaults to the PHI-encryption technical safeguard. */
  readonly controlId?: string;
}

const DEFAULT_CONTROL_ID = "DATA-PROTECTION.PHI-ENCRYPTION";
const COLLECTOR_ID = "substrate.field-crypto-policy";
const TITLE = "PHI fields encrypted at rest (per-tenant field-crypto)";

/** True iff the stored value is a well-formed AES-256-GCM field-crypto envelope (encrypted at rest). */
function isEncryptedAtRest(storedValue: string): boolean {
  try {
    return parseEnvelope(storedValue).algId === ALG_AES_256_GCM;
  } catch {
    // parseEnvelope throws on plaintext / wrong length / unknown format-version or alg-id — all of
    // which mean the value is NOT a value we can attest as encrypted at rest.
    return false;
  }
}

/** Build the PHI encryption-at-rest collector. Pure: an at-rest snapshot in, an evidence result out. */
export function fieldCryptoPolicyCollector(
  options: FieldCryptoPolicyCollectorOptions = {},
): EvidenceCollector<FieldCryptoPolicyFact> {
  const controlId = options.controlId ?? DEFAULT_CONTROL_ID;
  // A passing automated check still invites a manual key-management attestation (HSM/KMS custody).
  const manualSlots: readonly ManualAttachmentSlot[] = [
    {
      id: "encryption-key-management-policy",
      label: "Encryption key-management / HSM custody policy",
      required: false,
    },
  ];

  return {
    id: COLLECTOR_ID,
    controlId,
    title: TITLE,
    manualSlots,
    collect(fact: FieldCryptoPolicyFact): CollectorResult {
      const fieldCount = fact.fields.length;

      // Nothing inspected → PHI encryption posture cannot be attested. Refuse to guess a pass.
      if (fieldCount === 0) {
        return unresolvedResult(
          {
            collectorId: COLLECTOR_ID,
            controlId,
            title: TITLE,
            summary:
              "no PHI-bearing fields were inspected for at-rest encryption",
            facts: {
              fieldCount: 0,
              encryptedCount: 0,
              plaintextFields: [],
              unsampledFields: [],
            },
            manualSlots,
          },
          "no PHI encryption posture was gathered; at-rest encryption cannot be attested",
        );
      }

      const plaintextFieldsRaw: string[] = [];
      const unsampledFieldsRaw: string[] = [];
      for (const f of fact.fields) {
        if (f.storedValue === null) {
          unsampledFieldsRaw.push(f.field);
        } else if (!isEncryptedAtRest(f.storedValue)) {
          plaintextFieldsRaw.push(f.field);
        }
      }
      // Deterministic: sort field names so input order never changes the evidence bytes.
      const sortFields = (a: string, b: string): number =>
        a < b ? -1 : a > b ? 1 : 0;
      const plaintextFields = plaintextFieldsRaw.sort(sortFields);
      const unsampledFields = unsampledFieldsRaw.sort(sortFields);
      const encryptedCount =
        fieldCount - plaintextFields.length - unsampledFields.length;
      const facts = {
        fieldCount,
        encryptedCount,
        plaintextFields,
        unsampledFields,
      };

      // A real deficiency (PHI stored NOT encrypted) is the strongest signal — flag it first.
      if (plaintextFields.length > 0) {
        return flaggedResult(
          {
            collectorId: COLLECTOR_ID,
            controlId,
            title: TITLE,
            summary: `${String(plaintextFields.length)} of ${String(fieldCount)} PHI fields are not encrypted at rest`,
            facts,
            manualSlots,
          },
          `PHI fields not encrypted with an AES-256-GCM field-crypto envelope: ${plaintextFields.join(", ")}`,
        );
      }

      // Some fields had no row to sample → evidence absent for those. Refuse to attest the whole.
      if (unsampledFields.length > 0) {
        return unresolvedResult(
          {
            collectorId: COLLECTOR_ID,
            controlId,
            title: TITLE,
            summary: `${String(unsampledFields.length)} of ${String(fieldCount)} PHI fields had no stored value to inspect`,
            facts,
            manualSlots,
          },
          `no at-rest sample for PHI fields: ${unsampledFields.join(", ")}; encryption cannot be attested`,
        );
      }

      return passResult({
        collectorId: COLLECTOR_ID,
        controlId,
        title: TITLE,
        summary: `all ${String(fieldCount)} PHI fields are encrypted at rest (AES-256-GCM field-crypto envelope)`,
        facts,
        manualSlots,
      });
    },
  };
}
