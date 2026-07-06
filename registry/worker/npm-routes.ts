// npm-protocol surface for the registry Worker (ADR-0223). Turns the read-only index Worker into a
// real npm registry a buyer's `bun install @caisson/<edition>` can hit: an ABBREVIATED packument per
// module + tarball bytes served same-origin from R2 (A1), gated by the SAME offline-Ed25519
// entitlement math the index routes already run (`baseModuleIds` ∪ `expandEntitlements`, reused — NOT
// re-implemented; the license verify itself is injected as `resolveEntitlements`). handler.ts stays
// byte-identical: this is an additive module, dispatched from deploy-entry.ts on npm path shapes only.
//
// Fork locks (ADR-0223): A1 same-origin proxy · B1 base served here too · C1 raw license token as
// _authToken → Authorization: Bearer · D3 401-bare / 404-with-token (no existence leak, ADR-0076) ·
// E1 latest-only dist-tag · F1 offline revocation · G1 CF Worker + R2 · H1 commercial tarball sidecar
// (Fork 1.1: git-tracked registry/tarballs.json, inlined at build time exactly like index.json).
import { z } from "zod";
import {
  type RegistryIndex,
  baseModuleIds,
  loadRegistryIndex,
} from "../schema/registry-index";
import {
  type ResolvedEntitlements,
  type ResolvedGate,
  resolveGate,
  windowFilterEntry,
} from "./handler";

// --- tarball sidecar (Fork 1.1) ------------------------------------------------------------------
// Maps `<@caisson/module>@<version>` → the R2 object key + the two integrity forms npm needs
// (`shasum` = SHA-1, `integrity` = sha512 SRI) + `meta`: the abbreviated-packument install fields
// (deps/bin/engines) lifted from the PACKED tarball's package.json — where `bun pm pack` has already
// rewritten `workspace:*` to concrete versions. Without these the client installs the tarball but
// NONE of its dependencies (npm builds the tree from the packument, not the tarball). CI (Task 3)
// writes this from the pack; the Worker only READS it. `.strict()` at the boundary.
const DepMap = z.record(z.string(), z.string());
const PackumentMeta = z
  .object({
    dependencies: DepMap.optional(),
    optionalDependencies: DepMap.optional(),
    peerDependencies: DepMap.optional(),
    bin: z.union([z.string(), DepMap]).optional(),
    engines: DepMap.optional(),
  })
  .strict();
export type PackumentMeta = z.infer<typeof PackumentMeta>;

const TarballDist = z
  .object({
    key: z.string().min(1),
    shasum: z.string().min(1),
    integrity: z.string().min(1),
    size: z.number().int().nonnegative(),
    // Optional so a pre-meta sidecar row (or a package with no deps) still parses.
    meta: PackumentMeta.optional(),
  })
  .strict();

const TarballSidecar = z
  .object({
    // JSON has no comments; a `$comment` key carries the schema note. Allowed under `.strict()`.
    $comment: z.string().optional(),
    tarballs: z.record(z.string(), TarballDist),
  })
  .strict();

export type TarballSidecar = z.infer<typeof TarballSidecar>;

/** Parse-or-throw the tarball sidecar. The single sanctioned way to obtain a typed sidecar. */
export function loadTarballSidecar(raw: unknown): TarballSidecar {
  return TarballSidecar.parse(raw);
}

// --- R2 binding (injected; mocked in tests, real R2Bucket in production) --------------------------
/** Exactly what `new Response(body)` accepts (`BodyInit | null | undefined`), taken from the Response
 *  constructor so no DOM/BodyInit global is needed and no cross-lib ReadableStream clash arises. */
type ResponseBody = ConstructorParameters<typeof Response>[0];

/** The minimal slice of Cloudflare's `R2Bucket` this Worker uses — a keyed object read. The real R2
 *  `ReadableStream` and a test `Uint8Array` both satisfy `ResponseBody`; the Worker feeds `body`
 *  straight into `new Response(body)`. */
export interface TarballObjectBody {
  readonly body: ResponseBody;
}
export interface TarballBucket {
  get(key: string): Promise<TarballObjectBody | null>;
}
export interface NpmEnv {
  readonly TARBALLS: TarballBucket;
}

export interface NpmHandlerOptions {
  /** Per-request license resolver (the offline license verify, injected — same as handler.ts). */
  readonly resolveEntitlements: (
    request: Request,
  ) => ResolvedEntitlements | null;
}

// --- routing shapes -------------------------------------------------------------------------------
// npm escapes the scope `/` in the PACKUMENT path (`/@caisson%2ffield-crypto`) but NOT in the TARBALL
// path (`/@caisson/field-crypto/-/…`, verdaccio#4913) — match a literal slash there. The tarball
// filename DROPS the scope, per real npmjs: `<name>-<version>.tgz`.
const PACKUMENT_RE = /^\/@caisson(?:%2[Ff]|\/)([a-z0-9-]+)$/;
const TARBALL_RE =
  /^\/@caisson\/([a-z0-9-]+)\/-\/([a-z0-9-]+)-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.tgz$/;

/** True for any path this npm surface owns — dispatched from deploy-entry; everything else is the
 *  untouched index handler. Packument/tarball are `/@caisson…`; ping/audits/keys are `/-/…`. */
export function isNpmPath(pathname: string): boolean {
  return pathname.startsWith("/@caisson") || pathname.startsWith("/-/");
}

// --- gated response headers (mirrors handler.ts:31-42 discipline) ---------------------------------
// EVERY npm response is per-caller: `private, no-store` + `Vary: Authorization` so a commercial
// packument/tarball is never served from a shared cache to a different (unentitled) buyer.
function gatedHeaders(extra: Record<string, string>): Record<string, string> {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "cache-control": "private, no-store",
    vary: "Authorization",
    ...extra,
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: gatedHeaders({
      "content-type": "application/json; charset=utf-8",
    }),
  });
}

function errorJson(status: number, error: string): Response {
  // 401 carries WWW-Authenticate so npm/bun retries WITH the _authToken (Bearer). D3: bare → 401.
  const extra: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
  };
  if (status === 401) extra["www-authenticate"] = "Bearer";
  return new Response(JSON.stringify({ error }), {
    status,
    headers: gatedHeaders(extra),
  });
}

// The entitled-set + updates-window gate math is handler.ts's exported `resolveGate` — ONE
// implementation for both surfaces (was a duplicated private copy here pre-ADR-0251).

// D3 gate: entitled → allowed (null); unentitled + no auth → 401 (retry with token); unentitled +
// auth present → 404 (indistinguishable from unknown, ADR-0076 no-existence-leak).
function gateStatus(
  entitled: Set<string>,
  id: string,
  hasAuth: boolean,
): number | null {
  if (entitled.has(id)) return null;
  return hasAuth ? 404 : 401;
}

interface PackumentDist {
  readonly tarball: string;
  readonly shasum: string;
  readonly integrity: string;
}
interface PackumentVersion {
  readonly name: string;
  readonly version: string;
  readonly dist: PackumentDist;
  // Abbreviated-packument install fields (from `meta`); spread through so the client resolves the
  // dependency tree. Absent when the package has none. (`| undefined` for the spread under
  // exactOptionalPropertyTypes — `packumentMeta` strips undefined values before they land here.)
  readonly dependencies?: Record<string, string> | undefined;
  readonly optionalDependencies?: Record<string, string> | undefined;
  readonly peerDependencies?: Record<string, string> | undefined;
  readonly bin?: string | Record<string, string> | undefined;
  readonly engines?: Record<string, string> | undefined;
}

/**
 * Synthesize the ABBREVIATED packument (`application/vnd.npm.install-v1+json` shape) from a (possibly
 * window-filtered, ADR-0251) index entry + tarball sidecar. Only versions with a sidecar entry
 * (packed + uploaded) are exposed; `dist-tags.latest` is the entry's `.latest` (E1, latest-only —
 * already recomputed to the newest in-window version when a window applied). Content negotiation is
 * a no-op: we ALWAYS return abbreviated, so the vendor `Accept` header can never 406 (the
 * bun-breaking bug).
 */
function abbreviatedPackument(
  entry: RegistryIndex["modules"][number] | undefined,
  sidecar: TarballSidecar,
  id: string,
  origin: string,
): Record<string, unknown> {
  const slug = id.slice("@caisson/".length);
  const versions: Record<string, PackumentVersion> = {};
  let modified: string | undefined;
  if (entry !== undefined) {
    for (const v of entry.versions) {
      const dist = sidecar.tarballs[`${id}@${v.version}`];
      if (dist === undefined) continue; // not yet packed/uploaded — omit from the packument
      versions[v.version] = {
        name: id,
        version: v.version,
        dist: {
          tarball: `${origin}/@caisson/${slug}/-/${slug}-${v.version}.tgz`,
          shasum: dist.shasum,
          integrity: dist.integrity,
        },
        // Carry the resolved deps/bin/engines so the client can build the install tree. Spreading
        // `undefined` is a no-op, so a meta-less row stays `{name,version,dist}`.
        ...dist.meta,
      };
      if (v.version === entry.latest || modified === undefined)
        modified = v.publishedAt;
    }
  }
  return {
    name: id,
    "dist-tags": { latest: entry?.latest ?? "0.0.0" },
    versions,
    modified: modified ?? new Date(0).toISOString(),
  };
}

/**
 * Build the npm-protocol handler over the inlined index + tarball sidecar. Returns an ASYNC fetch
 * (the tarball path awaits R2). Routes:
 *   GET /-/ping                                → 200 {}
 *   GET /@caisson%2f<name>  | /@caisson/<name> → abbreviated packument (gated)
 *   GET /@caisson/<name>/-/<name>-<v>.tgz      → tarball bytes from R2 (gated, re-checked)
 *   any write (PUT/POST/…) or unknown /-/ read → 501 / 404 (degrades `npm audit`, never `install`)
 */
export function createNpmHandler(
  index: RegistryIndex,
  sidecar: TarballSidecar,
  options: NpmHandlerOptions,
): (request: Request, env?: NpmEnv) => Promise<Response> {
  // Re-validate once (defense in depth, same as createIndexHandler) — a caller can't slip an
  // unparsed object past the type.
  const validated = loadRegistryIndex(index);
  const resolve = options.resolveEntitlements;
  // The free base is NEVER window-filtered (ADR-0251: the window governs entitled COMMERCIAL pulls).
  const baseIds = new Set<string>(baseModuleIds(validated));

  return async (request: Request, env?: NpmEnv): Promise<Response> => {
    // Writes are out of scope (CI uploads straight to R2): PUT publish + POST audits → 501.
    if (request.method !== "GET") return errorJson(501, "not_implemented");

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/-/ping") return json({}, 200);

    const gate: ResolvedGate = resolveGate(validated, resolve, request);
    const entitled = gate.entitled;
    // Window-filter an entitled COMMERCIAL entry's versions (ADR-0244/0251); base + an unbounded
    // window pass through untouched. `null` = every version is out-of-window (fail-closed).
    const windowed = (
      id: string,
    ): RegistryIndex["modules"][number] | undefined | null => {
      const entry = validated.modules.find((m) => m.id === id);
      if (entry === undefined) return undefined;
      if (gate.updatesUntil === null || baseIds.has(id)) return entry;
      return windowFilterEntry(entry, gate.updatesUntil);
    };
    const hasAuth = request.headers.get("authorization") !== null;

    const tb = TARBALL_RE.exec(path);
    if (tb) {
      const [, name, fileName, version] = tb;
      if (
        name === undefined ||
        fileName === undefined ||
        version === undefined ||
        fileName !== name
      ) {
        return errorJson(404, "not_found");
      }
      const id = `@caisson/${name}`;
      const status = gateStatus(entitled, id, hasAuth);
      if (status !== null) return errorJson(status, "not_found");
      // ADR-0244/0251 per-version window check BEFORE the R2 fetch: the gate above proved only
      // module-level entitlement — an out-of-window (or index-unknown) version of an entitled
      // commercial module is 404 even though the tarball exists in R2 (fail-closed; the packument
      // filter alone would still leave the raw version URL pullable).
      if (gate.updatesUntil !== null && !baseIds.has(id)) {
        const entry = windowed(id);
        if (
          entry === undefined ||
          entry === null ||
          !entry.versions.some((v) => v.version === version)
        ) {
          return errorJson(404, "not_found");
        }
      }
      const bucket = env?.TARBALLS;
      if (bucket === undefined)
        return errorJson(503, "tarball_store_unavailable");
      const obj = await bucket.get(`${name}/${name}-${version}.tgz`);
      if (obj === null) return errorJson(404, "not_found");
      return new Response(obj.body, {
        status: 200,
        headers: gatedHeaders({ "content-type": "application/octet-stream" }),
      });
    }

    const pk = PACKUMENT_RE.exec(path);
    if (pk) {
      const name = pk[1];
      if (name === undefined) return errorJson(404, "not_found");
      const id = `@caisson/${name}`;
      const status = gateStatus(entitled, id, hasAuth);
      if (status !== null) return errorJson(status, "not_found");
      // A fully-out-of-window entry (windowed → null) synthesizes an EMPTY packument — the module
      // stays visible to its (entitled) buyer, but no version resolves (ADR-0251).
      return json(
        abbreviatedPackument(
          windowed(id) ?? undefined,
          sidecar,
          id,
          url.origin,
        ),
        200,
      );
    }

    // Unknown npm read (/-/npm/v1/keys, audits GET, malformed) → 404. Degrades `npm audit`, never install.
    return errorJson(404, "not_found");
  };
}
