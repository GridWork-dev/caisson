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
 * Security (threat TM-E — over-expansion): the expansion is fail-closed. An unknown purchased id (not
 * the bundle sentinel, not a known edition, not an indexed module) THROWS rather than silently
 * granting or silently dropping; one bad id rejects the whole expansion. No `timingSafeEqual` is used
 * here on purpose — purchased ids, edition names, and module slugs are PUBLIC catalog identifiers, not
 * secrets, so there is no timing side-channel to close. The timing-safe entitlement compare lives at
 * the per-tool buyer-MCP gate (ADR-0076), where a caller's entitlement set is matched against a
 * tool's required entitlement. Scope (ADR-0071): this fixes the expansion DATA MODEL only;
 * entitlement-vs-allowlist enforcement TIMING is the separate P5 question.
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

/** Every module whose `editions[]` contains `edition` (index-derived membership). */
function membersOfEdition(index: RegistryIndex, edition: Edition): string[] {
  return index.modules
    .filter((m) => latestManifest(m).editions.includes(edition))
    .map((m) => m.id);
}

/** The base = every module scoped to no edition (`editions[] === []`) — ships with every edition. */
function baseMembers(index: RegistryIndex): string[] {
  return index.modules
    .filter((m) => latestManifest(m).editions.length === 0)
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
 * Expand a buyer's purchased ids (editions / the bundle / à-la-carte module slugs) into the flat
 * member-module slug set the ADR-0008/0021 allowlist gate checks. Membership is read from `index`
 * ONLY (ADR-0071). Fail-closed: an unknown purchased id throws (TM-E). An empty purchase yields an
 * empty set (no entitlement → no access).
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
    // Fail closed (TM-E): not the bundle, not a known edition, not an indexed module → never grant.
    throw new Error(
      `unknown purchased entitlement id (not the bundle, a known edition, or an indexed module): ${JSON.stringify(
        purchased,
      )}`,
    );
  }

  return members;
}

/**
 * Convenience over `expandEntitlements`: load the built registry index from disk through the single
 * sanctioned read path (`loadRegistryIndexFromFile`, ADR-0047) and expand. This is the ADR-0071
 * wiring — the resolver consumes the built index, never raw manifests.
 */
export function expandEntitlementsFromFile(
  indexPath: string,
  purchasedIds: readonly string[],
): Set<string> {
  return expandEntitlements(loadRegistryIndexFromFile(indexPath), purchasedIds);
}
