// src/inference/sigv4.ts — hand-rolled AWS Signature Version 4 on node:crypto (ADR-0209). The
// SDK-import boundary confines vendor SDKs to ai-config/ai-kit, so the Bedrock rented
// transport signs its own requests: the deterministic HMAC-SHA256 chain (kDate → kRegion →
// kService → kSigning) over a canonical request, exactly as the AWS SigV4 spec defines it. The
// module is PURE — no network, no env reads, no implicit clock (the caller passes `date`) — so the
// whole derivation is pinned in sigv4.test.ts against the documented AWS test vectors (fixed date
// 20150830T123600Z, credentials AKIDEXAMPLE / wJalrXUtnFEMI…) independent of any live call.
//
// Scope (the ceiling is named): the canonical path is double-URI-encoded (the non-S3
// rule) and assumed pre-normalized — the Bedrock transport constructs its own `/model/{id}/…`
// paths, so dot-segment normalization is out of scope. S3's single-encode / UNSIGNED-PAYLOAD
// variants are likewise out of scope: this signs bedrock-runtime requests, nothing else.
import { createHash, createHmac } from "node:crypto";

/** Static or STS-temporary AWS credentials. `sessionToken` (STS) is signed when present. */
export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

/** One request to sign. `headers` are the extra headers to include in the signature (e.g.
 *  `content-type`); `host` (from `url`) and `x-amz-date` are always added and signed. */
export interface SigV4Request {
  method: string;
  url: URL;
  headers?: Readonly<Record<string, string>>;
  body: string;
  region: string;
  service: string;
  /** The signing timestamp. Explicit so tests pin the documented fixed-date vectors. */
  date: Date;
  /**
   * Attach + sign `x-amz-content-sha256` (default true — the Bedrock posture). The documented
   * AWS example vectors omit the header (its hash still terminates the canonical request), so the
   * vector tests pass `false` to reproduce them byte-for-byte.
   */
  includeBodyHashHeader?: boolean;
}

/** The signature derivation, returned whole so tests can pin every intermediate. */
export interface SigV4Result {
  /** Headers to attach to the outgoing request: `authorization`, `x-amz-date`, and (per options)
   *  `x-amz-content-sha256` / `x-amz-security-token`. `host` is excluded — the runtime derives it
   *  from the URL, and it always equals the signed value. */
  headers: Record<string, string>;
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
}

/** AWS `UriEncode`: RFC 3986 unreserved chars pass; everything else percent-encodes (uppercase
 *  hex). `encodeURIComponent` is close but leaves `!'()*` bare — encode those too. */
function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * The SigV4 signing-key chain: `kDate = HMAC("AWS4"+secret, date)`, then region, service, and the
 * literal `aws4_request`. Exported so the documented derivation vector pins it directly.
 */
export function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/** `YYYYMMDDTHHMMSSZ` from a `Date` (the `x-amz-date` wire form). */
function toAmzDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** Canonical URI: the already-encoded path, URI-encoded AGAIN per segment (the non-S3 double-
 *  encode rule; `/` separators are preserved). An empty path canonicalizes to `/`. */
function canonicalUri(url: URL): string {
  const path = url.pathname === "" ? "/" : url.pathname;
  return path.split("/").map(uriEncode).join("/");
}

/** Canonical query: each name/value URI-encoded, sorted by encoded name then encoded value. */
function canonicalQuery(url: URL): string {
  return Array.from(url.searchParams.entries())
    .map(([name, value]) => ({
      name: uriEncode(name),
      value: uriEncode(value),
    }))
    .sort((a, b) =>
      a.name === b.name
        ? a.value.localeCompare(b.value)
        : a.name.localeCompare(b.name),
    )
    .map((p) => `${p.name}=${p.value}`)
    .join("&");
}

/**
 * Sign one request with AWS SigV4. Signed headers always include `host` and `x-amz-date`, plus
 * every caller-provided header, plus `x-amz-content-sha256` / `x-amz-security-token` per options —
 * so the Bedrock transport's minimum set is `content-type;host;x-amz-content-sha256;x-amz-date`.
 */
export function signSigV4(
  request: SigV4Request,
  credentials: SigV4Credentials,
): SigV4Result {
  const amzDate = toAmzDate(request.date);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(request.body);
  const includeBodyHash = request.includeBodyHashHeader ?? true;

  // Canonical headers: lowercase names, trimmed values with inner runs of spaces collapsed,
  // sorted by name. `host` comes from the URL so the signed value always matches the wire.
  const headerMap = new Map<string, string>();
  headerMap.set("host", request.url.host);
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    headerMap.set(name.toLowerCase(), value.trim().replace(/ +/g, " "));
  }
  headerMap.set("x-amz-date", amzDate);
  if (includeBodyHash) headerMap.set("x-amz-content-sha256", payloadHash);
  if (
    credentials.sessionToken !== undefined &&
    credentials.sessionToken !== ""
  ) {
    headerMap.set("x-amz-security-token", credentials.sessionToken);
  }
  const sortedNames = Array.from(headerMap.keys()).sort();
  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${headerMap.get(name) ?? ""}\n`)
    .join("");
  const signedHeaders = sortedNames.join(";");

  const canonicalRequest = [
    request.method.toUpperCase(),
    canonicalUri(request.url),
    canonicalQuery(request.url),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${request.region}/${request.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(
    credentials.secretAccessKey,
    dateStamp,
    request.region,
    request.service,
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign, "utf8")
    .digest("hex");

  const headers: Record<string, string> = {
    "x-amz-date": amzDate,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
  if (includeBodyHash) headers["x-amz-content-sha256"] = payloadHash;
  if (
    credentials.sessionToken !== undefined &&
    credentials.sessionToken !== ""
  ) {
    headers["x-amz-security-token"] = credentials.sessionToken;
  }

  return { headers, canonicalRequest, stringToSign, signature };
}
