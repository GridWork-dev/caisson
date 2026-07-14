// The `@caisson/kernel/evidence` subpath (T-E1) — the audit-chain evidence-pack builder. The
// standalone verifier (`standalone-verifier.mjs`) is deliberately NOT re-exported here: it is a
// self-contained asset embedded into a built pack's `verify.mjs`, not a TS module a caller imports.
export {
  buildEvidencePack,
  EVIDENCE_PACK_FORMAT_VERSION,
  type BuildEvidencePackInput,
  type EvidencePack,
  type EvidencePackAnchorAuth,
  type EvidencePackFile,
  type EvidencePackMeta,
} from "./pack.ts";
