// Authed deny-set publisher endpoint (ADR-0225 R-4=B, launch-runbook §8 DEPLOY step 2): the "small
// authed shim in front of the bucket" the admin-side publisher PUTs to, so no R2/SigV4 credential
// ever enters the admin app's blast radius. One route, one verb, one object:
// `PUT /revocations/deny-set.json` with `Authorization: Bearer <REVOCATIONS_PUT_TOKEN>` and body
// `{"revokedLicenseIds": ["<uuid>", …]}` (the exact shape apps/admin's denySetPublisher sends).
//
// Fail-closed at every step: the route is NOT served (404, indistinguishable from an unknown path)
// until BOTH the worker secret and the R2 binding are provisioned; a wrong bearer is 401 with no
// detail; the body is Zod-strict validated and size-capped; the stored object is the VALIDATED,
// deduped, sorted re-serialization — never the raw request bytes. The read side
// (revocation-list.ts) stays fail-OPEN by design: a broken deny-set never blocks installs.
//
// The bearer compare is timing-safe without node:crypto (workerd + bun both ship crypto.subtle):
// SHA-256 both sides (the security-floor variable-length pattern), then a constant-time XOR fold
// over the two fixed 32-byte digests — no early exit, no length side channel.
import { revocationArtifactSchema } from "./revocation-list";

/** Structural R2 write surface (mirrors deploy-entry's zero-dep structural binding types). */
export interface R2PutBucketLike {
  put(key: string, value: string): Promise<unknown>;
}

export interface RevocationPutEnv {
  REVOCATIONS?: R2PutBucketLike;
  /** The shared bearer (worker secret). Unset ⇒ the route is not served (404). */
  REVOCATIONS_PUT_TOKEN?: string;
}

export const REVOCATION_PUT_PATH = "/revocations/deny-set.json";
/** The R2 object key — the SINGLE source both halves share (deploy-entry derives its reader key
 *  from this): the reader fails OPEN by design, so a writer/reader key drift would silently
 *  disable every revoke with zero error signal. */
export const REVOCATION_OBJECT_KEY = REVOCATION_PUT_PATH.slice(1);
/** Request-body byte cap — operator revokes are low-volume; 512 KiB ≈ 12k UUID entries. */
const MAX_BODY_BYTES = 524_288;

// The write side validates the EXACT schema the read side parses (revocation-list.ts) — a shim
// that accepted a shape the fail-open reader silently drops would store a deny-set that never
// denies anyone. One schema, no drift.
const denySetBodySchema = revocationArtifactSchema;

// Security-floor response headers (identity/security.md) — applied to EVERY response, mirroring
// npm-routes' gatedHeaders so this surface is not the one route missing them.
function shimResponse(body: string | null, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    },
  });
}

async function bearerMatches(
  presented: string,
  expected: string,
): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(presented)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i += 1) diff |= (av[i] ?? 0) ^ (bv[i] ?? 0);
  return diff === 0;
}

/** `true` when this request is for the publisher route (exact path, PUT only). */
export function isRevocationPutRequest(
  method: string,
  pathname: string,
): boolean {
  return method === "PUT" && pathname === REVOCATION_PUT_PATH;
}

/**
 * Handle one publisher PUT. The caller has already matched method + path via
 * {@link isRevocationPutRequest}; everything else — provisioning, auth, size, shape — is enforced
 * here, fail-closed.
 */
export async function handleRevocationPut(
  request: Request,
  env: RevocationPutEnv,
): Promise<Response> {
  const token = env.REVOCATIONS_PUT_TOKEN?.trim() ?? "";
  const bucket = env.REVOCATIONS;
  // Unprovisioned ⇒ the route does not exist. 404 (not 401/503) so probing cannot distinguish
  // "not deployed yet" from "no such path".
  if (token === "" || bucket === undefined) {
    return shimResponse("not found", 404);
  }

  const auth = request.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (presented === "" || !(await bearerMatches(presented, token))) {
    return shimResponse("unauthorized", 401);
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return shimResponse("payload too large", 413);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return shimResponse("payload too large", 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return shimResponse("invalid JSON", 400);
  }
  const body = denySetBodySchema.safeParse(parsed);
  if (!body.success) {
    return shimResponse("invalid deny-set shape", 400);
  }

  // Canonicalize: dedupe + sort so the stored artifact is deterministic regardless of publisher
  // ordering, and never echo raw input bytes into the bucket.
  const ids = [...new Set(body.data.revokedLicenseIds)].sort();
  await bucket.put(
    REVOCATION_OBJECT_KEY,
    JSON.stringify({ revokedLicenseIds: ids }),
  );
  return shimResponse(null, 204);
}
