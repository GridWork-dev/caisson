// GET /api/admin/audit/proof — the operator proof-bundle endpoint (T-A1, per-row verification SPEC).
//
// H1 / binding #1: this is the OPERATOR surface. The target `account` is a validated UUID INPUT
// (operator cross-tenant inspection is the design), gated by an in-handler `requireAdmin` re-check
// (never the proxy header — security floor) + access-logging (M1). The strictly-session-derived,
// RLS-scoped TENANT route is a SEPARATE endpoint (GATE-2) that ships after the apps/site freeze lifts.
//
// The whole contract in one read: 401 without a verified allowlisted session · `.strict()` query in
// and `.strict()` body out (binding #6) · seq bounded server-side (`ValidationError` -> 400, L1) ·
// missing anchor -> 200 `unverifiable` (fail-closed, never a fabricated pass) · redaction enforced
// SERVER-SIDE so the original payload never crosses the wire (H3) · WORM key built server-side only ·
// rate-limited (M4) · every read access-logged (M1).
import { ValidationError } from "@caisson/kernel";
import { withAdminWrite } from "@caisson/org-controls";
import {
  insertAdminActionLog,
  wormAnchorAccount,
} from "@caisson/service-license";
import { TokenBucketLimiter } from "@caisson/rate-limit";
import { ZodError } from "zod";
import { json, requireAdmin } from "@/lib/admin-route";
import { getAdminMutationDeps } from "@/lib/admin-mutations-runtime";
import {
  assembleProofSuccess,
  AuditProofQuery,
  ProofSuccessSchema,
  ProofUnverifiableSchema,
} from "@/lib/audit-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// M4 / binding #9 — a per-(actor,account) token bucket over the endpoint. Fork f does one WORM GET per
// inspected row, so an authenticated caller scripting `seq` requests amplifies WORM GETs into egress
// cost + store throttling (a cheap authed cost-DoS). Reuses the shared `@caisson/rate-limit` primitive;
// the "ip" slot carries the composite `actor|account` key. A global ceiling backstops key spraying.
// ponytail: single-instance in-memory limiter — adequate for this low-cardinality operator surface;
// swap to the DB-backed account-store limiter if this ever fronts a multi-replica or tenant surface.
const LIMITER = new TokenBucketLimiter<"audit_proof">({
  perIp: { audit_proof: { capacity: 60, windowMs: 60_000 } },
  global: { audit_proof: { capacity: 600, windowMs: 60_000 } },
  maxEntries: 10_000,
});

/** Every response carries the security-floor headers via `json()` plus `Vary: Cookie` (M2) — a proof
 *  bundle is auth-dimensioned and must not be served from a shared cache to another session. */
function respond(body: unknown, status = 200): Response {
  const res = json(body, status);
  res.headers.set("Vary", "Cookie");
  return res;
}

export async function GET(req: Request): Promise<Response> {
  // binding #1 — re-run the real better-auth + allowlist check IN the handler, never trust the proxy.
  const actor = await requireAdmin(req);
  if (actor === null) return respond({ error: "unauthorized" }, 401);

  // binding #6 — `.strict()` query; unknown fields / non-UUID account / non-integer seq -> 400.
  let query: { account: string; seq: number };
  try {
    query = AuditProofQuery.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
  } catch (err) {
    const issues = err instanceof ZodError ? err.issues : undefined;
    return respond({ error: "invalid request", issues }, 400);
  }
  const { account, seq } = query;

  const decision = LIMITER.check("audit_proof", `${actor}|${account}`);
  const globalDecision = LIMITER.checkGlobal("audit_proof");
  if (!decision.allowed || !globalDecision.allowed) {
    const res = respond({ error: "rate limited" }, 429);
    res.headers.set(
      "Retry-After",
      String(Math.max(decision.retryAfterSec, globalDecision.retryAfterSec)),
    );
    return res;
  }

  const deps = await getAdminMutationDeps();

  // The chain is keyed by the wormAnchorAccount-derived UUID (`append()` used it). For a UUID input
  // this only lowercases, so `getRowProof` -> `anchorKey` -> `buildArtifactKey` gets a well-formed
  // UUID segment: the WORM key is constructed SERVER-SIDE from the validated account + seq, never from
  // a client-supplied string (CR-07 §5).
  const anchorAccount = wormAnchorAccount(account);
  let proof;
  try {
    proof = await deps.worm.getRowProof(anchorAccount, seq);
  } catch (err) {
    // L1 — seq out of range (`== length` truncation-probe / `> length`): a 400, never a silent pass.
    if (err instanceof ValidationError) {
      return respond({ error: "seq out of range" }, 400);
    }
    throw err;
  }

  // M1 — record the operator's cross-tenant proof read under the RAW target account. Best-effort: a
  // logging failure never denies the read verdict (a read has no state to keep consistent) and never
  // 500s — the verdict itself is the product.
  try {
    await withAdminWrite(deps.db, (tx) =>
      insertAdminActionLog(tx, {
        actorEmail: actor,
        targetAccountId: account,
        action: "audit_proof_read",
        before: null,
        after: { seq },
      }),
    );
  } catch {
    /* access-log best-effort; see above */
  }

  if ("unverifiable" in proof) {
    return respond(
      ProofUnverifiableSchema.parse({
        state: "unverifiable",
        reason: proof.reason,
      }),
    );
  }

  // binding #3 (H3) redaction + L2 (no WORM key) + strict OUT: assemble redacts server-side and drops
  // the internal key; the outgoing body is strict-parsed so an unknown field is rejected on the way out.
  const body = await assembleProofSuccess(proof, new Date());
  return respond(ProofSuccessSchema.parse(body));
}
