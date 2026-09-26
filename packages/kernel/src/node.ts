// @caisson-sh/kernel/node — the node-only half of the kernel, split out of the `.` barrel.
//
// WHY THIS FILE EXISTS: the `.` barrel used to re-export four modules that import a node builtin at
// module scope — `crypto.ts` + `audit-chain.ts` + `migration-assembly.ts` (`node:crypto`) and
// `ssrf.ts` (`node:dns/promises`). A browser bundler resolves the whole module graph behind a
// specifier, so ANY import of "@caisson-sh/kernel" — even one that only wanted `strictObject` — pulled
// those builtins and failed to bundle. That is what forced `apps/site` to hand-port parity-tested
// mirrors of packages it already depends on. The `.` barrel is now browser-safe and everything that
// needs a node builtin lives here.
//
// This entry is a SUPERSET of the `.` barrel: a node-side consumer that reaches for any symbol below
// changes one specifier and keeps its whole import list. There is no symbol reachable from `.` that
// is not also reachable from here, so `.` vs `/node` is a bundling boundary, never an API fork.
export * from "./index.ts";

// --- Constant-time secret comparison (node:crypto timingSafeEqual). ------------------------------
export {
  safeEqualFixed,
  safeEqualVariable,
  verifyAllowlisted,
  verifyBearer,
} from "./crypto.ts";

// --- Cloudflare Worker origin verification (fixed 32-byte base64url secret + rotation). --------
export {
  loadOriginGateConfig,
  originRequestAuthorized,
  originVerificationDisabledFor,
  ORIGIN_SECRET_HEADER,
} from "./origin-gate.ts";
export type { OriginGateConfig, OriginGateEnv } from "./origin-gate.ts";

// --- Audit-chain hashing (node:crypto createHash). The pure canonicalization + the chain value
// TYPES stay on the `.` barrel via `canonical.ts`; only the hashing half is here. -----------------
export {
  contentHash,
  hashChainLink,
  chainEntry,
  buildChain,
  verifyChain,
  anchorChain,
} from "./audit-chain.ts";

// --- Migration assembly (node:crypto createHash). Its TYPES stay on the `.` barrel — a
// `export type` re-export is erased at emit, so it never taints a bundle. ------------------------
export {
  assembleMigrations,
  assembleMigrationsWithPinnedPrefix,
} from "./migration-assembly.ts";

// --- Serving revision (node:fs readFileSync of the repo-root `.caisson-revision` carrier). -------
export {
  parseRevision,
  readRevision,
  resetServingRevisionCache,
  revisionFilePath,
  servingRevision,
  REVISION_FILENAME,
  REVISION_HEADER,
  UNKNOWN_REVISION,
} from "./revision.ts";

// --- SSRF guard (node:dns/promises lookup). ------------------------------------------------------
export {
  assertResolvedHostPublic,
  assertSafePublicUrl,
  assertSafePublicUrlResolved,
  isPrivateAddress,
  ssrfGuardedFetch,
} from "./ssrf.ts";
