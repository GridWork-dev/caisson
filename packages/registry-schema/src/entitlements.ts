/**
 * Entitlement-expansion resolver (ADR-0071). Commerce sells the library three ways at once
 * (ADR-0012): whole editions, one bundle, and per-module à-la-carte. The ADR-0008 buyer-MCP gate,
 * however, checks a FLAT set of bare module slugs — it has no notion of an edition or a bundle. This
 * resolver turns a purchased bundle / edition / module id into the member-module slug set the gate
 * consumes. ADR-0257 renames the editions to the persona bundle vocabulary (`./bundle-vocabulary`);
 * the resolve-time alias map inside `expandEntitlements` is the SINGLE alias point keeping every
 * legacy purchased id resolving forever.
 *
 * The registry INDEX is the single source of truth for membership (ADR-0071 binding): an edition's
 * members = every manifest whose `editions[]` contains that edition; the bundle's members = base
 * (every non-edition-scoped module) ∪ all editions. Membership is DERIVED from the index here, never
 * hand-listed and never baked into the entitlement token — a module added to an edition reaches
 * existing entitled buyers through the index alone, with no token re-issue. The resolver reads the
 * already-built index (the derived allowlist projection), not raw manifests per call (ADR-0071
 * rejected "resolve from manifests live on every gate call").
 *
 * Per-module à-la-carte purchase ids are the BARE package slug, no `@caisson/`
 * prefix (e.g. `field-crypto` for `@caisson/field-crypto`) — `@caisson/pricebook`'s PURCHASE_BOOK
 * rows key `entitlements` this way. `expandEntitlements` resolves a bare slug against the index the
 * same as the long-supported full `@caisson/<slug>` module-id form, plus a fail-SOFT carve-out for a
 * module that is SOLD but not yet published (`RESERVED_MODULE_ENTITLEMENT_IDS`, below).
 *
 * Security (threat TM-E — over-expansion): the expansion is fail-closed. An unknown purchased id (not
 * the bundle sentinel, not a known edition, not an indexed module, not a reserved future-module slug)
 * THROWS rather than silently granting or silently dropping; one bad id rejects the whole expansion.
 * No `timingSafeEqual` is used here on purpose — purchased ids, edition names, and module slugs are
 * PUBLIC catalog identifiers, not secrets, so there is no timing side-channel to close. The
 * timing-safe entitlement compare lives at the per-tool buyer-MCP gate (ADR-0076), where a caller's
 * entitlement set is matched against a tool's required entitlement. Scope (ADR-0071): this fixes the
 * expansion DATA MODEL only; entitlement-vs-allowlist enforcement TIMING is a separate concern this
 * module does not resolve.
 */
import { z } from "zod";
import {
  isBundleId,
  normalizeEntitlementId,
  type BundleId,
} from "./bundle-vocabulary";
import { EDITIONS, type ModuleManifest } from "./module-manifest";
import {
  loadRegistryIndexFromFile,
  moduleAllowlist,
  type RegistryIndex,
} from "./registry-index";

/**
 * The legacy bundle sentinel — "buy everything" (ADR-0012's "base + all editions"). Kept for the
 * purchased ids already in the books/tokens; it normalizes to the `everything` bundle id at the
 * single alias point inside `expandEntitlements` (ADR-0257) and keeps resolving forever.
 *
 * @deprecated new purchase rows use the `everything` bundle id (`./bundle-vocabulary`).
 */
export const BUNDLE_ID = "bundle" as const;

type Edition = (typeof EDITIONS)[number];
const MODULE_ID_RE = /^@caisson\/[a-z0-9-]+$/;
/** Bare package-slug form (no `@caisson/` prefix) — the per-module purchase-id convention. Same
 *  character class as the slug half of `MODULE_ID_RE`. */
const MODULE_SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Bare-slug entitlement ids reserved for a commercial module that is SOLD (a `PURCHASE_BOOK` /
 * `PLAN_BOOK` row exists, so a buyer may already hold a grant for it) but not yet published to the
 * registry index. A purchased reserved id must never fail-closed-throw (TM-E) — that would break
 * `expandEntitlements` for the buyer's ENTIRE purchased-id set the moment they hold any other
 * entitlement alongside it (one bad id rejects the whole expansion), which would 500/lock out an
 * already-paying buyer's unrelated modules. It also must not silently substitute a different grant:
 * a reserved id expands to NOTHING until its package ships and lands in the ledger. Remove an id here
 * in the SAME change that first indexes its package — its bare slug then resolves through the
 * ordinary indexed-module branch below.
 */
export const RESERVED_MODULE_ENTITLEMENT_IDS: ReadonlySet<string> = new Set([
  "alerting",
  "retention-runner",
]);

/** Boundary guard (ADR-0021 input-validation): the purchased ids are an array of bounded, non-empty
 *  strings. Classification + fail-closed rejection of unknown values happens below. */
const PurchasedIds = z.array(z.string().trim().min(1).max(128));

/** The membership-bearing manifest for a module entry = its `latest` published version's manifest
 *  (falling back to the last version). Membership reflects the current catalog, not a frozen token. */
function latestManifest(
  entry: RegistryIndex["modules"][number],
): ModuleManifest {
  const version =
    entry.versions.find((v) => v.version === entry.latest) ??
    entry.versions[entry.versions.length - 1];
  if (version === undefined) {
    throw new Error(`registry index entry ${entry.id} carries no versions`);
  }
  return version.manifest;
}

/** The legacy edition names that alias to `bundleId` (the reverse of the ADR-0257 alias map) — the
 *  historical `kind:"edition"` index entries and self-declared `editions[]` memberships stay
 *  resolvable under the new bundle ids forever. */
function legacyEditionNamesFor(bundleId: BundleId): readonly Edition[] {
  return EDITIONS.filter((e) => normalizeEntitlementId(e) === bundleId);
}

/**
 * The member-module ids of the bundle `bundleId` (index-derived, ADR-0071/0077/0257 — generalizes
 * the pre-0257 `membersOfEdition`). Three membership sources, unioned:
 *
 *   (1) a module that SELF-DECLARES membership in its own manifest `editions[]` under a LEGACY
 *       edition name aliasing to this bundle (the legacy/fixture path); AND
 *   (2) the legacy edition META-package's frozen `members` map (ADR-0077) — the AUTHORITATIVE
 *       composition. In the real catalog an edition's commercial member modules (field-crypto,
 *       audit-worm, ai-meter, …) carry `editions[] === []` in their OWN manifest — they do NOT
 *       self-declare — so (1) alone returns only the edition meta-package itself. Once the free-view
 *       floor is Apache-only (`baseModuleIds`), an edition license carrying just its sentinel
 *       (`["compliance"]`) would then no longer deliver those commercial members. Reading the
 *       meta-package's `members` map fixes that in the EXPANSION/DATA, with no license re-issue and
 *       no member-manifest/ledger edit. AND
 *   (3) a `kind:"bundle"` index entry whose `@caisson/<slug>` slug IS this bundle id (ADR-0257) —
 *       its frozen `members` map expands exactly like (2). Both meta forms coexist during the
 *       transition; the union keeps every legacy token and every legacy index entry resolving.
 *
 * Guarded by the allowlist: a members-map id must be an indexed module to be granted (fail-closed,
 * index-derived — a stale/phantom pin can never grant a non-existent module; the full-tree pin test
 * already forbids stale pins). Apache base ids that appear in a members map (kernel, tenancy-rls) are
 * harmless — they are already the free floor. This never widens the FREE view: a bundle's members are
 * granted only to a caller holding that bundle's entitlement, never to the anonymous base floor.
 */
function membersOfBundle(index: RegistryIndex, bundleId: BundleId): string[] {
  const allow = moduleAllowlist(index);
  const editionNames: ReadonlySet<string> = new Set<string>(
    legacyEditionNamesFor(bundleId),
  );
  const bundleModuleId = `@caisson/${bundleId}`;
  const members = new Set<string>();
  for (const m of index.modules) {
    const manifest = latestManifest(m);
    const selfDeclared = manifest.editions.some((e) => editionNames.has(e));
    if (selfDeclared) members.add(m.id); // (1) self-declared under a legacy edition name
    // (2) the legacy edition META-package / (3) the bundle entry contribute their frozen `members`
    // map (ADR-0077/0257).
    const isMetaForBundle =
      (manifest.kind === "edition" && selfDeclared) ||
      (manifest.kind === "bundle" && m.id === bundleModuleId);
    if (isMetaForBundle) {
      for (const memberId of Object.keys(manifest.members)) {
        if (allow.has(memberId)) members.add(memberId);
      }
    }
  }
  return [...members];
}

/** True iff the index carries a first-class `kind:"bundle"` entry for `bundleId` (ADR-0257). */
function hasBundleEntry(index: RegistryIndex, bundleId: BundleId): boolean {
  const bundleModuleId = `@caisson/${bundleId}`;
  return index.modules.some(
    (m) => m.id === bundleModuleId && latestManifest(m).kind === "bundle",
  );
}

/** The base = every module scoped to no edition (`editions[] === []`) — ships with every edition. */
function baseMembers(index: RegistryIndex): string[] {
  return index.modules
    .filter((m) => latestManifest(m).editions.length === 0)
    .map((m) => m.id);
}

/**
 * The open SPDX license (ADR-0094/0097). A base-kind module ships this IFF it belongs to the free
 * open Base substrate; every commercial module ships `LicenseRef-Caisson-Commercial`. Kept in sync
 * with the repo's license gate so the free-view floor and the license check always agree.
 */
const OPEN_LICENSE = "Apache-2.0";

/**
 * The FREE-VIEW substrate — the Apache-2.0 open Base module ids the registry Worker serves
 * UNAUTHENTICATED (ADR-0094/0097 open-core). Returns all modules that are base-scoped
 * (`editions[] === []`) AND licensed as Apache-2.0.
 *
 * The open Base consists of: kernel · auth · tenancy-rls · ui · billing · credits · jobs · email ·
 * ai-config · mcp-server · registry-schema · observability · cli · migrate · license-verify. These are free, always
 * discoverable/installable, and independent of any entitlement. The cli, migrate, and license-verify
 * packages ship-with-generator as part of the open Base (ADR-0136).
 *
 * Commercial base-scoped modules (field-crypto · audit-worm · ai-meter · ai-evals · guardrails ·
 * prompt-registry · local-store · agent-kernel · pricebook) are licensed as `LicenseRef-Caisson-Commercial`
 * and are NOT included in this free-view floor. They require offline-verified Ed25519 entitlement
 * (via bare-slug / edition / bundle grant, resolved by `expandEntitlements`).
 *
 * Membership is keyed on the manifest `license` field (SPDX identifier), not a hand-maintained allowlist,
 * ensuring agreement with the repo's license gate and staying correct as the open set evolves. The
 * Worker unions this free-view floor into every served view: community users get exactly this; licensed
 * buyers get this ∪ their expanded entitlements. On resolver error the Worker degrades to this open set
 * only, fail-safe to never serve a commercial module to unauthorized callers.
 */
export function baseModuleIds(index: RegistryIndex): readonly string[] {
  return index.modules
    .filter((m) => {
      const manifest = latestManifest(m);
      return (
        manifest.editions.length === 0 && manifest.license === OPEN_LICENSE
      );
    })
    .map((m) => m.id);
}

/**
 * The DERIVED full-catalog rule: base ∪ every legacy edition's members, purely from the index. This
 * is the `everything` bundle's expansion until W5 lands its explicit `kind:"bundle"` entry (ADR-0257
 * — the explicit membership rule replaces this derivation; `expandEntitlements` already prefers the
 * indexed entry when present).
 */
function fullCatalogMembers(index: RegistryIndex): string[] {
  const out = new Set<string>(baseMembers(index));
  for (const edition of EDITIONS) {
    const bundleId = normalizeEntitlementId(edition);
    if (!isBundleId(bundleId)) continue; // unreachable — every legacy edition aliases to a bundle id
    for (const id of membersOfBundle(index, bundleId)) out.add(id);
  }
  return [...out];
}

/**
 * Expand a buyer's purchased ids (bundles — new ids or legacy edition/bundle-sentinel aliases — /
 * à-la-carte module slugs, either the full `@caisson/<slug>` module-id form or the bare `<slug>`
 * per-module purchase-id form) into the flat member-module slug set the ADR-0008/0021 allowlist
 * gate checks. Membership is read from `index` ONLY (ADR-0071). This loop's `normalizeEntitlementId`
 * call is the SINGLE alias point (ADR-0257): legacy purchased ids resolve here forever, on every
 * path (server resolver, Worker, MCP gate) — no caller pre-normalizes. Fail-closed: an unknown
 * purchased id throws (TM-E) — EXCEPT a reserved future-module slug
 * (`RESERVED_MODULE_ENTITLEMENT_IDS`), which expands to nothing rather than throwing (fail-soft:
 * the module is sold but not yet published, never a substitute grant). A KNOWN bundle id with no
 * index presence likewise expands to nothing (same semantics an index-absent edition always had —
 * never an over-grant, never a whole-expansion throw for a paying buyer's other ids). An empty
 * purchase yields an empty set (no entitlement → no access).
 */
export function expandEntitlements(
  index: RegistryIndex,
  purchasedIds: readonly string[],
): Set<string> {
  const ids = PurchasedIds.parse(purchasedIds);
  const allowlist = moduleAllowlist(index);
  const members = new Set<string>();

  for (const purchased of ids) {
    // ADR-0257 single alias point: legacy ids (ai-kit/local-ai/agent-dev/bundle/compliance) map to
    // the new bundle vocabulary; everything else passes through untouched.
    const id = normalizeEntitlementId(purchased);
    if (isBundleId(id)) {
      // `everything` prefers its explicit indexed bundle entry (W5's replacement rule); until that
      // entry lands it falls back to the derived full-catalog rule — identical to the legacy
      // `bundle` sentinel's expansion.
      const expanded =
        id === "everything" && !hasBundleEntry(index, id)
          ? fullCatalogMembers(index)
          : membersOfBundle(index, id);
      for (const memberId of expanded) members.add(memberId);
      continue;
    }
    if (MODULE_ID_RE.test(id) && allowlist.has(id)) {
      members.add(id);
      continue;
    }
    if (MODULE_SLUG_RE.test(id)) {
      const candidate = `@caisson/${id}`;
      if (allowlist.has(candidate)) {
        members.add(candidate);
        continue;
      }
      if (RESERVED_MODULE_ENTITLEMENT_IDS.has(id)) {
        continue; // reserved (sold, not yet published) — grants nothing yet; never throws (TM-E carve-out)
      }
    }
    // Fail closed (TM-E): not a bundle (new id or legacy alias), not an indexed module, and not a
    // reserved future-module slug → never grant.
    throw new Error(
      `unknown purchased entitlement id (not a bundle, a legacy edition alias, an indexed module, or a reserved future module): ${JSON.stringify(
        purchased,
      )}`,
    );
  }

  return members;
}

/**
 * Convenience over `expandEntitlements` for callers that hold the index on DISK (e.g. CLI / build
 * tooling): load the built registry index through the single sanctioned read path
 * (`loadRegistryIndexFromFile`, ADR-0047), then expand. NOTE: the live entitlement paths do NOT route
 * through this — the server resolver (`resolveAccountEntitlements`) and the registry Worker both
 * expand against an in-memory `RegistryIndex` via `expandEntitlements`. Exported as part of the
 * @caisson/registry-schema public surface (ADR-0097).
 */
export function expandEntitlementsFromFile(
  indexPath: string,
  purchasedIds: readonly string[],
): Set<string> {
  return expandEntitlements(loadRegistryIndexFromFile(indexPath), purchasedIds);
}
