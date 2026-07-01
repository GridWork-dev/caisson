/**
 * Entitlement-expansion resolver (ADR-0071). Commerce sells the library three ways at once
 * (ADR-0012): whole editions, one bundle, and per-module à-la-carte. The ADR-0008 buyer-MCP gate,
 * however, checks a FLAT set of bare module slugs — it has no notion of an edition or a bundle. This
 * resolver turns a purchased edition / bundle / module id into the member-module slug set the gate
 * consumes.
 *
 * The registry INDEX is the single source of truth for membership (ADR-0071 binding): an edition's
 * members = every manifest whose `editions[]` contains that edition; the bundle's members = base
 * (every non-edition-scoped module) ∪ all editions. Membership is DERIVED from the index here, never
 * hand-listed and never baked into the entitlement token — a module added to an edition reaches
 * existing entitled buyers through the index alone, with no token re-issue. The resolver reads the
 * already-built index (the derived allowlist projection), not raw manifests per call (ADR-0071
 * rejected "resolve from manifests live on every gate call").
 *
 * Per-module à-la-carte purchase ids (P6-store track) are the BARE package slug, no `@caisson/`
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
 * expansion DATA MODEL only; entitlement-vs-allowlist enforcement TIMING is the separate P5 question.
 */
import { z } from "zod";
import { EDITIONS, type ModuleManifest } from "./module-manifest";
import {
  loadRegistryIndexFromFile,
  moduleAllowlist,
  type RegistryIndex,
} from "./registry-index";

/**
 * The bundle sentinel — "buy everything" (ADR-0012's "base + all editions"). Not an `@caisson/<slug>`
 * module id and not an edition name, so it cannot collide with either purchase form.
 */
export const BUNDLE_ID = "bundle" as const;

type Edition = (typeof EDITIONS)[number];
const EDITION_SET: ReadonlySet<string> = new Set<string>(EDITIONS);
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

function isEdition(id: string): id is Edition {
  return EDITION_SET.has(id);
}

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

/**
 * The member-module ids of `edition` (index-derived, ADR-0071/0077). Two membership sources, unioned:
 *
 *   (1) a module that SELF-DECLARES membership in its own manifest `editions[]` (the legacy/fixture
 *       path); AND
 *   (2) the edition META-package's frozen `members` map (ADR-0077) — the AUTHORITATIVE composition.
 *       In the real catalog an edition's commercial member modules (field-crypto, audit-worm, ai-meter,
 *       …) carry `editions[] === []` in their OWN manifest — they do NOT self-declare — so (1) alone
 *       returns only the edition meta-package itself. Once the free-view floor is Apache-only
 *       (`baseModuleIds`), an edition license carrying just its sentinel (`["compliance"]`) would then
 *       no longer deliver those commercial members. Reading the meta-package's `members` map fixes that
 *       in the EXPANSION/DATA, with no license re-issue and no member-manifest/ledger edit.
 *
 * Guarded by the allowlist: a members-map id must be an indexed module to be granted (fail-closed,
 * index-derived — a stale/phantom pin can never grant a non-existent module; the full-tree pin test
 * already forbids stale pins). Apache base ids that appear in a members map (kernel, tenancy-rls) are
 * harmless — they are already the free floor. This never widens the FREE view: an edition's members are
 * granted only to a caller holding that edition's entitlement, never to the anonymous base floor.
 */
function membersOfEdition(index: RegistryIndex, edition: Edition): string[] {
  const allow = moduleAllowlist(index);
  const members = new Set<string>();
  for (const m of index.modules) {
    const manifest = latestManifest(m);
    if (manifest.editions.includes(edition)) members.add(m.id); // (1) self-declared
    // (2) the edition META-package for THIS edition contributes its frozen `members` map (ADR-0077).
    if (manifest.kind === "edition" && manifest.editions.includes(edition)) {
      for (const memberId of Object.keys(manifest.members)) {
        if (allow.has(memberId)) members.add(memberId);
      }
    }
  }
  return [...members];
}

/** The base = every module scoped to no edition (`editions[] === []`) — ships with every edition. */
function baseMembers(index: RegistryIndex): string[] {
  return index.modules
    .filter((m) => latestManifest(m).editions.length === 0)
    .map((m) => m.id);
}

/**
 * The open SPDX license (ADR-0094/0097). A base-kind module ships this IFF it belongs to the free
 * open Base substrate; every commercial module ships `LicenseRef-Caisson-Commercial`. Mirrors the
 * standards-gate authority `tooling/standards-gate` (`OPEN_LICENSE` / `OPEN_BASE_NAMES`,
 * `checkOpenCoreLicensing`) so the free-view floor and the license gate agree.
 */
const OPEN_LICENSE = "Apache-2.0";

/**
 * The FREE-VIEW substrate — the module ids the registry Worker serves UNAUTHENTICATED (ADR-0094/0097
 * open-core). A module is free-view ONLY IF it is base-scoped (`editions[] === []`) AND ships the open
 * `Apache-2.0` license: the open substrate (kernel · auth · tenancy-rls · ui · billing · credits ·
 * jobs · email · ai-config · mcp-server · registry-schema) — free, always discoverable/installable,
 * independent of any entitlement.
 *
 * A COMMERCIAL base-kind module (`editions[] === []` but `LicenseRef-Caisson-Commercial` — the
 * à-la-carte compliance/AI primitives field-crypto · audit-worm · ai-meter · ai-evals · guardrails ·
 * prompt-registry · local-store · agent-kernel, AND the bundle-only commercial tooling cli · migrate ·
 * license-verify · pricebook) is DELIBERATELY EXCLUDED: it is NOT free base — it requires its own
 * offline-verified Ed25519 entitlement (a bare-slug / edition / bundle grant, resolved by
 * `expandEntitlements`). This closes the leak where any `editions[] === []` module was served free.
 *
 * Keyed on the manifest `license` (the SPDX legal lever), not a hand-maintained slug allowlist, so it
 * agrees with the standards-gate authority and stays correct if the open set changes. `baseMembers`
 * (above, index-derived by edition scope ALONE) stays license-blind on purpose: the BUNDLE = base ∪
 * every edition must still include the commercial base modules, so an entitled bundle/à-la-carte buyer
 * receives them. Only THIS free-view floor is license-gated. The Worker unions this into every served
 * view (community gets exactly this; a licensed buyer gets this ∪ their expanded purchases); fail-safe,
 * on any resolver error the Worker degrades to THIS open set only — never a commercial module.
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

/** The bundle = base ∪ every edition's members, derived purely from the index (== the full catalog). */
function bundleMembers(index: RegistryIndex): string[] {
  const out = new Set<string>(baseMembers(index));
  for (const edition of EDITIONS) {
    for (const id of membersOfEdition(index, edition)) out.add(id);
  }
  return [...out];
}

/**
 * Expand a buyer's purchased ids (editions / the bundle / à-la-carte module slugs, either the full
 * `@caisson/<slug>` module-id form or the bare `<slug>` per-module purchase-id form) into the flat
 * member-module slug set the ADR-0008/0021 allowlist gate checks. Membership is read from `index`
 * ONLY (ADR-0071). Fail-closed: an unknown purchased id throws (TM-E) — EXCEPT a reserved future-
 * module slug (`RESERVED_MODULE_ENTITLEMENT_IDS`), which expands to nothing rather than throwing
 * (fail-soft: the module is sold but not yet published, never a substitute grant). An empty purchase
 * yields an empty set (no entitlement → no access).
 */
export function expandEntitlements(
  index: RegistryIndex,
  purchasedIds: readonly string[],
): Set<string> {
  const ids = PurchasedIds.parse(purchasedIds);
  const allowlist = moduleAllowlist(index);
  const members = new Set<string>();

  for (const purchased of ids) {
    if (purchased === BUNDLE_ID) {
      for (const id of bundleMembers(index)) members.add(id);
      continue;
    }
    if (isEdition(purchased)) {
      for (const id of membersOfEdition(index, purchased)) members.add(id);
      continue;
    }
    if (MODULE_ID_RE.test(purchased) && allowlist.has(purchased)) {
      members.add(purchased);
      continue;
    }
    if (MODULE_SLUG_RE.test(purchased)) {
      const candidate = `@caisson/${purchased}`;
      if (allowlist.has(candidate)) {
        members.add(candidate);
        continue;
      }
      if (RESERVED_MODULE_ENTITLEMENT_IDS.has(purchased)) {
        continue; // reserved (sold, not yet published) — grants nothing yet; never throws (TM-E carve-out)
      }
    }
    // Fail closed (TM-E): not the bundle, not a known edition, not an indexed module, and not a
    // reserved future-module slug → never grant.
    throw new Error(
      `unknown purchased entitlement id (not the bundle, a known edition, an indexed module, or a reserved future module): ${JSON.stringify(
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
