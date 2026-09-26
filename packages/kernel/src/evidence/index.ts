// The `@caisson-sh/kernel/evidence` subpath (T-E1) — the audit-chain evidence-pack builder. Executable
// verification deliberately lives out of band in the separate `@caisson-sh/verify-pack` package and is
// never embedded into the evidence it vouches for.
export {
  assertEvidencePackKeyId,
  buildEvidencePack,
  evidencePackManifest,
  evidencePackManifestForInput,
  evidencePackSealPayloadBytes,
  EVIDENCE_PACK_FORMAT_VERSION,
  EVIDENCE_PACK_KEY_ID_MAX_LENGTH,
  EVIDENCE_PACK_MANIFEST_VERSION,
  EVIDENCE_PACK_SEAL_DOMAIN,
  EVIDENCE_PACK_SEAL_VERSION,
  isEvidencePackKeyId,
  type BuildEvidencePackInput,
  type EvidencePack,
  type EvidencePackAnchorAuth,
  type EvidencePackFile,
  type EvidencePackManifest,
  type EvidencePackManifestEntry,
  type EvidencePackManifestInput,
  type EvidencePackMeta,
  type EvidencePackSeal,
  type EvidencePackSealPayloadInput,
} from "./pack.ts";
