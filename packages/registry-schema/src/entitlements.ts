/**
 * Entitlement-expansion resolver (ADR-0071). Commerce sells the library two ways (ADR-0257/0258): one of
 * six bundles, and per-module à-la-carte. The ADR-0008 buyer-MCP gate, however, checks a FLAT set of bare
 * module slugs — it has no notion of a bundle. This resolver turns a purchased bundle / module id into the
 * member-module slug set the gate consumes. ADR-0257 dissolved the four editions into the persona bundle
 * vocabulary (`./bundle-vocabulary`); ADR-0270 then purged the edition purchase ids entirely (zero real
 * buyers). The resolve-time `normalizeEntitlementId` call inside `expandEntitlements` is the SINGLE
 * purchase-alias point — narrowed to the module-rename mechanism (empty today) — keeping any future renamed
 * purchased id resolving forever. The legacy `kind:"edition"` index/ledger entries stay served forever; a
 * bundle's expansion still folds their members via the decoupled `EDITION_BUNDLE_ID` index relation.
 *
 * The registry INDEX is the single source of truth for membership (ADR-0071 binding): a bundle
 * resolves through its indexed `kind:"bundle"` members map plus any legacy edition metadata mapped
 * to that bundle. `everything` has no catalog-wide fallback; without its indexed bundle entry it
 * grants nothing. Membership is never baked into the entitlement token — a bundle members-map
 * update reaches existing entitled buyers through the index alone, with no token re-issue. The
 * resolver reads the already-built index (the derived allowlist projection), not raw manifests per
 * call (ADR-0071 rejected "resolve from manifests live on every gate call").
 *
 * Per-module à-la-carte purchase ids are the BARE package slug, no `@caisson/`
 * prefix (e.g. `field-crypto` for `@caisson/field-crypto`) — `@caisson/pricebook`'s PURCHASE_BOOK
 * rows key `entitlements` this way. `expandEntitlements` resolves a bare slug against the index the
 * same as the long-supported full `@caisson/<slug>` module-id form, plus a fail-SOFT carve-out for a
 * module that is SOLD but not yet published (`RESERVED_MODULE_ENTITLEMENT_IDS`, below).
 *
 * Security (threat TM-E — over-expansion): the expansion is fail-closed. An unknown purchased id (not a
 * bundle id, not an indexed module, not a reserved future-module slug) THROWS rather than silently granting
 * or silently dropping; one bad id rejects the whole expansion.
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

type Edition = (typeof EDITIONS)[number];

/**
 * The edition→bundle INDEX-RESOLUTION relation (ADR-0257/0077). DECOUPLED from the purchased-id alias
 * spine (`./bundle-vocabulary` `LEGACY_ENTITLEMENT_ALIASES`, narrowed to empty by ADR-0270): the historical
 * `kind:"edition"` ledger/index entries stay served forever (ADR-0006 append-only; the operator-gated
 * bundle-only index republish is a separate decision), so a bundle purchase must still resolve the members
 * its legacy edition meta-package contributes. This is index machinery, NOT a purchase alias — an edition id
 * is no longer a purchasable/normalizable id (ADR-0270), it is only a served artifact.
 * `legacyEditionNamesFor` reads THIS map; the single purchase-alias point in `expandEntitlements` reads the
 * (now-empty) spine. Both live-index and legacy tokens keep their exact member sets.
 */
const EDITION_BUNDLE_ID: ReadonlyMap<Edition, BundleId> = new Map([
  ["compliance", "compliance"],
  ["ai-kit", "ai-production"],
  ["local-ai", "local-first"],
  ["agent-dev", "agentic-dev"],
]);
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
 *
 * Currently reserved: none. The 2026-07-20 compliance-gap arming quartet — `access-review`,
 * `risk-register`, `trust-page`, and `artifact-render` (published-never-sold render substrate,
 * the platform-reads/pricebook posture) — graduated in this same version cut: the cut created
 * their first index entries (each at 0.2.0), so per the rule above their reservations leave in
 * the change that acknowledges those entries. Index presence is not sellability: the three SKUs
 * stay `sellable: false` until the post-publish membership PR flips them, and artifact-render
 * is never sold.
 * `agent-usage` graduated at the 2026-07-18 full-catalog consume (its first index entry).
 * Prior graduations: `agent-trajectory` graduated 2026-07-17 — the slice-1 changeset
 * consume auto-ledgered/indexed `@caisson/agent-trajectory@0.2.0`, so per the rule above its
 * reservation left in the change that acknowledged that first index entry. Index presence is NOT
 * sellability: it stays `sellable: false`, carries no PRICE_AUTHORITY row, and joins no bundle
 * members map until the ADR-0351 rider-3 publish gate at the end of the runtime program, so no
 * purchase path reaches it. `ui-pro` graduated the documented way 2026-07-07 — removed in the same
 * change that first indexed `@caisson/ui-pro@0.1.0` and repinned the everything members map off the
 * 0.0.0 sentinel (everything@0.2.2). (`alerting` and `retention-runner` graduated the same way
 * earlier.) The mechanism stays: the next sold-or-reserved-before-published SKU adds its slug here
 * in the same commit that creates its purchase row (or its package).
 */
export const RESERVED_MODULE_ENTITLEMENT_IDS: ReadonlySet<string> =
  new Set<string>([
    // Empty: oscal-spine graduated in this release cut (the train appended oscal-spine@0.1.0, so
    // grants now resolve through the index and the reservation would be stale). Add a slug here
    // only while a module is SOLD but not yet published, and remove it in the version PR that
    // publishes it — the reserved-ids-staleness gate fails the release otherwise.
  ]);
/**
 * Exact first-publish versions for the temporary reservations above. The pre-publish member-pin
 * gate treats these pairs as resolving in the next release cut even though the workspace package
 * itself still carries Changesets' 0.0.0 pre-release sentinel. Keep this map key-identical to
 * {@link RESERVED_MODULE_ENTITLEMENT_IDS}; both entries leave when the first ledger row lands.
 */
export const RESERVED_MODULE_ENTITLEMENT_VERSIONS: ReadonlyMap<string, string> =
  new Map<string, string>([]);
// agent-usage graduated 2026-07-18: indexed (sellable:false) by the agent-runtime consume,
// so grants resolve via the index; it stays unsellable and in no bundle until its own
// publish gate (operator lock). agent-trajectory graduated earlier, at its first index entry.

/**
 * Bare-slug entitlement ids that are SOLD and stored as purchased grants for their OWN routing
 * purpose (a support tier, a Discord role signal, …) but are NOT a package and never will be —
 * unlike {@link RESERVED_MODULE_ENTITLEMENT_IDS} above (a temporary publishing-gap reservation
 * that graduates the moment its package is indexed), an id here has no package to graduate to and
 * stays fail-soft-to-nothing PERMANENTLY. Never throws (the same TM-E carve-out rationale): a
 * stray non-software purchased id must never fail-closed-brick the rest of a buyer's software
 * entitlement expansion — the risk `resolveAccountEntitlements`/the `/issue` validation/the
 * registry Worker all share this one function, so one bad id here would 500 every OTHER
 * entitlement the account holds too.
 *
 * Currently: `priority-support` (ADR-0278/0288) — a subscription that grants a Discord role +
 * a response-time support lane (`services/support-bot`), never registry/module access.
 */
export const NON_MODULE_ENTITLEMENT_IDS: ReadonlySet<string> = new Set<string>([
  "priority-support",
]);

/**
 * Compatibility grants for packages that permanently re-export a carved package.
 * This is deliberately NOT dependency closure: ADR-0238 rejected generic dependency-to-entitlement
 * expansion, while ADR-0384 explicitly guarantees that either OSCAL parent purchase keeps the
 * complete OSCAL surface after the carve. The relationship applies whether the parent was bought
 * directly or arrived through a bundle, because pre-carve bundle buyers received the same exports.
 * Only the two locked parent relationships live here.
 *
 * Keys and values are full registry module ids. A target grants only after it is indexed; while it
 * is a named pre-publish reservation the parent continues resolving to itself, so deployment before
 * the release train cannot lock out an existing parent buyer.
 */
export const COMPATIBILITY_REEXPORT_ENTITLEMENTS: ReadonlyMap<
  string,
  readonly string[]
> = new Map<string, readonly string[]>([
  ["@caisson/compliance-core", ["@caisson/oscal-spine"]],
  ["@caisson/frameworks-pack", ["@caisson/oscal-spine"]],
]);

/**
 * Named commercial runtime dependencies that are published but never sold independently. These
 * edges exist solely so a package manager can resolve the dependency tree of an entitled package;
 * they are not inferred from package manifests and do not create generic dependency closure.
 */
export const INTERNAL_RUNTIME_ENTITLEMENTS: ReadonlyMap<
  string,
  readonly string[]
> = new Map<string, readonly string[]>([
  ["@caisson/oscal-spine", ["@caisson/artifact-render"]],
]);

/** Boundary guard (ADR-0021 input-validation): the purchased ids are an array of bounded, non-empty
 *  strings. Classification + fail-closed rejection of unknown values happens below. */
const PurchasedIds = z.array(z.string().trim().min(1).max(128));

/**
 * Snapshot-at-sale filter context (ADR-0257 §1.2 / ADR-0247 F7 — the per-MEMBER join-date axis; the
 * D side of the D/E boundary, sibling of E's per-VERSION `updatesWindows` at the Worker). Turns a
 * buyer's signed `entitledSince` claim + a bundle-membership timeline (`@caisson/pricebook`) into a
 * fail-SOFT filter: a bundle MEMBER whose join instant is AFTER the buyer's `entitledSince` for that
 * bundle was not in the member set as of sale, so it is dropped. FAIL-SOFT by lock — never fail
 * closed against an existing token:
 *   - `entitledSince[bundleId]` ABSENT → the bundle is grandfathered → NO member filtering.
 *   - a member ABSENT from `membershipTimeline[bundleId]` (or a whole bundle absent) → the member is
 *     KEPT (missing join data never strips access).
 *   - an unparseable `entitledSince` OR join instant → treated as missing → KEPT.
 * The E per-version axis (published version ≤ `updatesWindows`) is enforced separately in the
 * registry Worker and is untouched here. Injected (not imported): `@caisson/registry-schema` is the
 * open Apache base and never depends "up" on the commercial `@caisson/pricebook` that owns the
 * timeline DATA — the caller wires the two.
 */
export interface EntitlementSnapshot {
  /** `purchasedEntitlementId → ISO instant` the buyer became entitled (claims `entitledSince`). */
  readonly entitledSince: Readonly<Record<string, string>>;
  /** `bundleId → (memberModuleId → ISO join instant)`. Member ids may be `@caisson/<slug>` or the
   *  bare `<slug>` (pricebook's convention) — the filter matches either form. */
  readonly membershipTimeline: Readonly<
    Record<string, Readonly<Record<string, string>>>
  >;
}

/** Strip the `@caisson/` scope so a bare-slug-keyed timeline (pricebook) matches an `@caisson/<slug>`
 *  member id. */
function bareSlug(moduleId: string): string {
  return moduleId.startsWith("@caisson/")
    ? moduleId.slice("@caisson/".length)
    : moduleId;
}

function addNamedEntitlementClosure(
  grantorId: string,
  allowlist: ReadonlySet<string>,
  members: Set<string>,
  visited: Set<string> = new Set<string>(),
): void {
  if (visited.has(grantorId)) return;
  visited.add(grantorId);
  for (const edges of [
    COMPATIBILITY_REEXPORT_ENTITLEMENTS,
    INTERNAL_RUNTIME_ENTITLEMENTS,
  ]) {
    for (const targetId of edges.get(grantorId) ?? []) {
      if (allowlist.has(targetId)) {
        members.add(targetId);
        addNamedEntitlementClosure(targetId, allowlist, members, visited);
        continue;
      }
      if (RESERVED_MODULE_ENTITLEMENT_IDS.has(bareSlug(targetId))) {
        continue;
      }
      throw new Error(
        `named entitlement target is neither indexed nor reserved: ${JSON.stringify(targetId)}`,
      );
    }
  }
}

/**
 * Drop the members of `bundleId` that joined AFTER the buyer's `entitledSince` for it (snapshot-at-
 * sale, ADR-0247 F7). Mutates `members` in place. FAIL-SOFT at every missing/malformed edge (see
 * {@link EntitlementSnapshot}): the only member removed is one with a PARSEABLE join instant strictly
 * after a PARSEABLE `entitledSince` for its bundle. An absent `entitledSince[bundleId]` skips the
 * bundle entirely (grandfathered).
 */
function applyMemberSnapshot(
  members: Set<string>,
  bundleId: BundleId,
  snapshot: EntitlementSnapshot,
): void {
  const since = snapshot.entitledSince[bundleId];
  if (since === undefined) return; // grandfathered: no per-member filtering for this bundle
  const cutoff = Date.parse(since);
  if (Number.isNaN(cutoff)) return; // unparseable entitledSince → fail soft (keep all)
  const joinDates = snapshot.membershipTimeline[bundleId];
  if (joinDates === undefined) return; // no timeline for this bundle → fail soft (keep all)
  for (const memberId of [...members]) {
    const raw = joinDates[memberId] ?? joinDates[bareSlug(memberId)];
    if (raw === undefined) continue; // missing join date → fail soft (keep)
    const joined = Date.parse(raw);
    if (Number.isNaN(joined)) continue; // unparseable join date → fail soft (keep)
    if (joined > cutoff) members.delete(memberId); // joined after sale → outside the snapshot
  }
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

/** The legacy edition names that map to `bundleId` (the reverse of `EDITION_BUNDLE_ID`) — the historical
 *  `kind:"edition"` index entries and self-declared `editions[]` memberships stay resolvable under the new
 *  bundle ids forever. Reads the decoupled index-resolution map, NOT the purchase alias spine (ADR-0270).
 *  Exported for the generator's edition-pin resolver (`@caisson/cli` `resolveEditionMembers` pass-2), which
 *  must resolve a bundle id to its legacy edition meta's frozen pins the same way `membersOfBundle` does. */
export function legacyEditionNamesFor(bundleId: BundleId): readonly Edition[] {
  return EDITIONS.filter((e) => EDITION_BUNDLE_ID.get(e) === bundleId);
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
function membersOfBundle(
  index: RegistryIndex,
  bundleId: BundleId,
  snapshot?: EntitlementSnapshot,
): string[] {
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
  // Snapshot-at-sale per-member filter (ADR-0247 F7 / ADR-0257 §1.2), fail-soft — no-op when no
  // snapshot is injected (the Wave-0 contract; the live Worker path stays unfiltered per the D/E
  // boundary until a caller wires the pricebook timeline + the buyer's `entitledSince`).
  if (snapshot !== undefined) applyMemberSnapshot(members, bundleId, snapshot);
  return [...members];
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
 * The open Base consists of: ai-config · analytics · auth · billing · cli · email · jobs · kernel ·
 * license-verify · mcp-server · migrate · observability · rate-limit · registry-schema · tenancy-rls ·
 * ui. These are free, always discoverable/installable, and independent of any entitlement. The cli,
 * migrate, and license-verify packages ship-with-generator as part of the open Base (ADR-0136).
 * `credits` is NOT in this list — it flipped to `LicenseRef-Caisson-Commercial` (the catalog-program
 * commercial flip); this comment is prose only (the code below keys on `manifest.license`, not this
 * list), kept in sync manually since it documents the CURRENT floor for a human reader.
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
 * Expand a buyer's purchased ids (bundle ids / à-la-carte module slugs, either the full `@caisson/<slug>`
 * module-id form or the bare `<slug>` per-module purchase-id form) into the flat member-module slug set the
 * ADR-0008/0021 allowlist gate checks. Membership is read from `index` ONLY (ADR-0071). This loop's
 * `normalizeEntitlementId` call is the SINGLE purchase-alias point (ADR-0257/0270): a renamed purchased id
 * resolves here forever, on every path (server resolver, Worker, MCP gate) — no caller pre-normalizes. The
 * dissolved edition ids are NOT aliases anymore (ADR-0270 purge); they resolve, if at all, only as their
 * still-indexed `@caisson/<edition>` meta-package. Fail-closed: an unknown
 * purchased id throws (TM-E) — EXCEPT a reserved future-module slug
 * (`RESERVED_MODULE_ENTITLEMENT_IDS`) or a permanent non-module id (`NON_MODULE_ENTITLEMENT_IDS`),
 * either of which expands to nothing rather than throwing (fail-soft): the module is sold but not
 * yet published (reserved), or is not a module at all and never will be (non-module) — neither is
 * ever a substitute grant. A KNOWN bundle id with no index presence likewise expands to nothing
 * (same semantics an index-absent edition always had — never an over-grant, never a
 * whole-expansion throw for a paying buyer's other ids). An empty purchase yields an empty set (no
 * entitlement → no access).
 *
 * `snapshot` (ADR-0257 §1.2 / ADR-0247 F7, OPTIONAL) applies the per-member snapshot-at-sale filter
 * (see {@link EntitlementSnapshot}): a bundle member that joined after the buyer's `entitledSince`
 * for that bundle is dropped, fail-soft. Omitted → identical to the pre-snapshot behavior (the
 * Wave-0 unfiltered contract; TM-E fail-closed throw untouched on either path).
 */
export function expandEntitlements(
  index: RegistryIndex,
  purchasedIds: readonly string[],
  snapshot?: EntitlementSnapshot,
): Set<string> {
  const ids = PurchasedIds.parse(purchasedIds);
  const allowlist = moduleAllowlist(index);
  const members = new Set<string>();

  for (const purchased of ids) {
    // Single purchase-alias point (ADR-0257/0270): a renamed purchased id maps to its current spelling;
    // everything else passes through untouched. The map is EMPTY post edition-trace purge (ADR-0270) —
    // this call stays as the one point the next module rename plugs into; no caller pre-normalizes.
    const id = normalizeEntitlementId(purchased);
    if (isBundleId(id)) {
      for (const memberId of membersOfBundle(index, id, snapshot)) {
        members.add(memberId);
        addNamedEntitlementClosure(memberId, allowlist, members);
      }
      continue;
    }
    if (MODULE_ID_RE.test(id) && allowlist.has(id)) {
      members.add(id);
      addNamedEntitlementClosure(id, allowlist, members);
      continue;
    }
    if (MODULE_SLUG_RE.test(id)) {
      if (NON_MODULE_ENTITLEMENT_IDS.has(id)) {
        // permanently non-module (sold, never a package) — grants nothing, never throws, and
        // wins over the indexed-module allowlist: if a package ever collided with this slug it
        // must NOT become a silent module grant to every holder of the id (TM-E carve-out).
        continue;
      }
      const candidate = `@caisson/${id}`;
      if (allowlist.has(candidate)) {
        members.add(candidate);
        addNamedEntitlementClosure(candidate, allowlist, members);
        continue;
      }
      if (RESERVED_MODULE_ENTITLEMENT_IDS.has(id)) {
        // reserved (sold, not yet published) — grants nothing, never throws (TM-E carve-out).
        continue;
      }
    }
    // Fail closed (TM-E): not a bundle id, not an indexed module, not a reserved future-module
    // slug, and not a permanent non-module id → never grant.
    throw new Error(
      `unknown purchased entitlement id (not a bundle, a legacy edition alias, an indexed module, a reserved future module, or a non-module id): ${JSON.stringify(
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
