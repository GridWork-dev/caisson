/**
 * Named-regime crosswalk model (ADR-0277 data + ADR-0279 claim posture). CLEAN-ROOM, OWN-AUTHORED.
 *
 * A regime crosswalk is the buyer-facing five-column mapping ADR-0277 locks: it answers "how does
 * Caisson's compliance bundle line up against MY named regime (SOC 2 / PCI DSS / GDPR)?" without
 * forcing the buyer to build the mapping themselves. It is DISTINCT from the canonical-control
 * catalog crosswalk in `registry/control.ts` (which points a Caisson canonical control at an
 * external requirement id): here the row is anchored on the REGIME control id and names the concrete
 * Caisson module/mechanism plus what the buyer still owns.
 *
 * The five columns (research memo `crosswalk-claim-language-2026-07-07.md` §c), never dropped:
 *   1. `control`             — the regime control id (e.g. `CC7.2`, `Req 10.3.2`, `Art. 32(1)(a)`).
 *   2. `summary`             — own-authored one-sentence paraphrase of the requirement (clean-room).
 *   3. `mechanism`           — the specific Caisson package + mechanism, never a bundle-level generality.
 *   4. `evidence`            — where the buyer looks for the artifact behind the claim.
 *   5. `buyerResponsibility` — the LOAD-BEARING column: what Caisson does NOT cover for this control.
 *
 * CLAIM POSTURE (ADR-0279, binding): `claim` is `"implements"` ONLY where a live test or CI artifact
 * in THIS repo proves the named technical control — and such a row MUST carry a `proof` pointer to it.
 * Everywhere else the claim is `"maps-to"` (domain overlap, not requirement satisfaction) and carries
 * no proof. The rule is encoded in the type (a discriminated union: `implements` without `proof` does
 * not typecheck) and re-enforced at author time by `defineRegimeCrosswalk`. Renderers pick language
 * MECHANICALLY from `claim` — never editorially. "certified" / "compliant" / "satisfies" are never
 * used with Caisson as the subject (§a/§b of the memo; ADR-0080 copy law).
 *
 * Depends only on `@caisson-sh/kernel` (the down-only floor, ADR-0003) — no edition or sibling dep.
 */
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson-sh/kernel";

/**
 * The three regimes ADR-0277 locks, plus `iso-27001` -- the fourth `regimes.ts`-pattern crosswalk
 * ADR-0333/ADR-0347 adds (own-authored, Legal-gate-capped at `maps-to`; see `regimes.ts`), plus
 * `nist-800-53` -- the fifth (ADR-0363/ADR-0364, the oscal-spine SPEC; see `nist-800-53.ts`).
 * FedRAMP itself is explicitly OUT (single corpus mention, deferred) -- the 800-53 axis is a
 * reference-catalog crosswalk, never a FedRAMP-readiness claim.
 */
export const RegimeId = z.enum([
  "soc2",
  "pci-dss",
  "gdpr",
  "iso-27001",
  "nist-800-53",
]);
export type RegimeId = z.infer<typeof RegimeId>;

/**
 * The kind of repo artifact that proves an `implements` claim (ADR-0279 enumerates exactly these
 * four linkable proof types). The path is repo-relative; a test asserts it resolves to a real file.
 */
export const ProofKind = z.enum([
  "test",
  "ci",
  "live-verification",
  "oscal-conformance",
]);
export type ProofKind = z.infer<typeof ProofKind>;

/**
 * A proof pointer — the linkable artifact behind an `implements` claim. `path` is repo-relative
 * (no absolute path, no `..`): a test file, a CI workflow, a live-verification harness, or an OSCAL
 * conformance check. Its existence is checked by the crosswalk test suite (ADR-0279: a row that
 * loses its proof must drop to `maps-to` in the same change).
 */
export const ProofPointer = strictObject({
  kind: ProofKind,
  path: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((p) => !p.includes("..") && !p.startsWith("/"), {
      message:
        "proof path must be a repo-relative path with no `..` and no leading `/`",
    }),
  /** Optional one-line note on what the artifact proves. */
  note: z.string().trim().min(1).max(300).optional(),
});
export type ProofPointer = z.infer<typeof ProofPointer>;

/**
 * Canonical control id — mirrors `registry/control.ts`'s pattern. Kept local (not imported) so this
 * module has no dependency on the canonical-control registry; only the shape is shared.
 */
const canonicalControlId = z
  .string()
  .regex(
    /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/,
    "must be an uppercase canonical control id (e.g. ACCESS-CONTROL.MFA)",
  );

/** The four columns shared by every row, regardless of claim level. */
const rowBase = {
  /** Regime control id — opaque label (regime ids carry parens/dots/spaces), bounded not patterned. */
  control: z.string().trim().min(1).max(80),
  /** Own-authored one-sentence paraphrase of the requirement (clean-room — never copied text). */
  summary: z.string().trim().min(1).max(600),
  /** The concrete Caisson package + mechanism this row is about (never a bundle-level generality). */
  mechanism: z.string().trim().min(1).max(400),
  /** Where the buyer finds the artifact behind the claim (a proof pointer, an export, a live proof). */
  evidence: z.string().trim().min(1).max(400),
  /** LOAD-BEARING: what Caisson does NOT cover for this control. Required — the row is dishonest without it. */
  buyerResponsibility: z.string().trim().min(1).max(600),
  /**
   * Optional pointer to a `@caisson-sh/frameworks-pack` canonical control (ADR-0347 Fork G1). Lets a
   * live collector run light this row through the same join `compliance-core`'s rollup uses for the
   * framework packs — additive, `.strict()`-safe. Unset today (no v1 caller wires it); the join
   * itself is a later-wave concern (ADR-0347 Fork G1 stages the actual join at the ISO crosswalk).
   */
  canonicalControlId: canonicalControlId.optional(),
  /**
   * NIST IR 8278A OLIR relationship vocabulary, verbatim (ADR-0364 F2) -- additive, `.strict()`-safe,
   * optional on every row so the four existing crosswalks (soc2/pci-dss/gdpr/iso-27001) are
   * untouched; in practice only `nist80053Crosswalk` (`nist-800-53.ts`) populates these three
   * fields. `relationship` is the set-theory correspondence between what the Caisson mechanism
   * actually covers and the cited requirement's scope; `rationale` is how that correspondence was
   * determined; `strength` is NIST's own OPTIONAL 0-10 confidence value (IR 8278A prescribes no
   * methodology for it). The `claim`/`maps-to` cap above is unaffected -- this vocabulary
   * describes the mapping, it never promotes the claim.
   */
  relationship: z
    .enum([
      "subset-of",
      "intersects-with",
      "equal",
      "superset-of",
      "not-related-to",
    ])
    .optional(),
  rationale: z.enum(["syntactic", "semantic", "functional"]).optional(),
  strength: z.number().int().min(0).max(10).optional(),
} as const;

/**
 * An assertive row: the mechanism implements a technical control a live repo artifact proves. `proof`
 * is REQUIRED (the discriminated union makes an `implements` row without it a type error).
 */
const implementsRow = strictObject({
  claim: z.literal("implements"),
  ...rowBase,
  proof: ProofPointer,
});

/** A conservative row: the mechanism maps to (shares a domain with) the requirement. No proof. */
const mapsToRow = strictObject({
  claim: z.literal("maps-to"),
  ...rowBase,
});

/** One crosswalk row — assertive (`implements` + proof) or conservative (`maps-to`), by `claim`. */
export const RegimeCrosswalkRow = z.discriminatedUnion("claim", [
  implementsRow,
  mapsToRow,
]);
export type RegimeCrosswalkRow = z.infer<typeof RegimeCrosswalkRow>;
export type RegimeCrosswalkRowInput = z.input<typeof RegimeCrosswalkRow>;

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Crosswalk-level seed provenance (ADR-0333/0347 Fork G2) — the URL + hash pin for the public-domain
 * mapping data a crosswalk was SEEDED from (check data only, never ingested text; licensing floor
 * ADR-0057/ADR-0333). One seed per crosswalk, not per row — the pin is uniform across every row a
 * crosswalk authors from the same mapping revision. Additive, `.strict()`-safe.
 */
export const RegimeCrosswalkSeedProvenance = strictObject({
  /** Stable id for the seed mapping (e.g. `nist-sp800-53r5-iso27001-2022-olir`). */
  sourceId: z.string().trim().min(1).max(120),
  sourceVersion: z.string().trim().min(1).max(80),
  /** The seed's canonical URL. HTTPS-only (never auto-coerced — security floor). */
  sourceUrl: z
    .string()
    .trim()
    .refine((u) => new URL(u).protocol === "https:", {
      message: "seed provenance sourceUrl must be an https:// URL",
    }),
  /** SHA-256 of the pinned seed bytes (e.g. the OLIR xlsx), lowercase 64-hex. */
  sourceDigest: z.string().regex(SHA256_HEX),
});
export type RegimeCrosswalkSeedProvenance = z.infer<
  typeof RegimeCrosswalkSeedProvenance
>;

/**
 * An authored regime crosswalk: the pinned regime revision + own-authored rows. Control ids must be
 * unique within the crosswalk. `regimeSpecificDisclaimer` is the one regime-specific sentence the
 * export folds into the shared disclaimer block (PCI SSC "does not make you PCI DSS compliant", the
 * SOC 2 attestation-not-certification note, the GDPR standalone-product-can't-be-certified note).
 */
export const RegimeCrosswalk = strictObject({
  regime: RegimeId,
  /** Human title, e.g. `SOC 2 — Trust Services Criteria (technical-control crosswalk)`. */
  title: z.string().trim().min(1).max(200),
  /** The pinned, dated regime revision — never an evergreen "current" claim (memo §c versioning). */
  regimeRevision: z.string().trim().min(1).max(200),
  /** Caisson crosswalk data version (versioned like the framework catalogs, e.g. `2026.1`). */
  crosswalkVersion: z.string().trim().min(1).max(40),
  /** The regime-specific disclaimer sentence folded into the exported disclaimer block. */
  regimeSpecificDisclaimer: z.string().trim().min(1).max(800),
  /** Optional crosswalk-level seed provenance (ADR-0347 Fork G2) — unset for a fully own-authored crosswalk. */
  seedProvenance: RegimeCrosswalkSeedProvenance.optional(),
  rows: z
    .array(RegimeCrosswalkRow)
    .min(1, "a regime crosswalk must declare at least one row")
    .refine((rs) => new Set(rs.map((r) => r.control)).size === rs.length, {
      message: "regime control ids must be unique within a crosswalk",
    }),
});
export type RegimeCrosswalk = z.infer<typeof RegimeCrosswalk>;
export type RegimeCrosswalkInput = z.input<typeof RegimeCrosswalk>;

/**
 * Author one regime crosswalk. Validates at call time — an `implements` row missing its `proof`, a
 * duplicate control id, or an over-long field fails closed with a redaction-safe `ValidationError`.
 */
export function defineRegimeCrosswalk(
  crosswalk: RegimeCrosswalkInput,
): RegimeCrosswalk {
  return parseStrict(RegimeCrosswalk, crosswalk);
}

// --- Disclaimer (embedded INSIDE the export artifact, not just on a rendering page — memo §c) -------
//
// Shared, own-authored scope language adapted from the vendor-safe patterns the research memo cites
// (AWS Config conformance-pack disclaimer, PCI SSC program-guide construction, the cyber-laws.com
// "relevance indicators, not compliance assertions" table disclaimer). Held as constants so every
// regime carries identical base language; the export folds in the per-regime sentence + revision pin.

/** Caisson is a toolmaker, not an assessed entity — no certification, no seal, no borrowed badge. */
const NOT_A_CERTIFICATION =
  "This crosswalk is not a certification, attestation, or compliance validation. Caisson ships " +
  "technical controls that run inside your own systems; for this regime Caisson is not an assessed, " +
  "certified, or compliant entity — you are. No regulatory seal, logo, or badge is claimed or implied.";

/** AWS Config conformance-pack construction: a mapping does not ensure compliance. */
const NO_COMPLIANCE_GUARANTEE =
  "These mappings are not designed to, and do not, ensure your compliance with any standard or " +
  "framework, and it is your responsibility to ensure any such compliance. Using this crosswalk " +
  "neither replaces your own efforts to achieve compliance nor guarantees that you will pass any " +
  "assessment.";

/** How to read the two claim levels — mechanically, never as a satisfaction claim. */
const CLAIM_LEGEND =
  "'maps to' means a Caisson mechanism addresses the same security domain as the requirement; it is " +
  "not an assertion that the requirement is satisfied. 'implements' is used only where a live test or " +
  "CI artifact in the Caisson repository proves the named technical control, and each such row links " +
  "that proof. Neither claim covers the full requirement — see each row's buyer-responsibility column.";

/** The not-covered disclosure: only technical controls are here; the rest is the buyer's, and a gap is a gap. */
const SCOPE_BOUNDARY =
  "This crosswalk covers only the technical controls the compliance bundle ships. Organizational, " +
  "administrative, and physical controls — policy, personnel, vendor and access management, incident " +
  "response, your own data classification and configuration, and the independent assessment itself — " +
  "remain your responsibility. A requirement not listed here is not covered by Caisson.";

/** The disclaimer block embedded in every export artifact. Machine-readable, cold-reader-safe. */
export interface RegimeCrosswalkDisclaimer {
  readonly notACertification: string;
  readonly noComplianceGuarantee: string;
  readonly claimLegend: string;
  readonly scopeBoundary: string;
  readonly regimeSpecific: string;
  readonly regimeRevision: string;
}

/** The exported crosswalk artifact — the disclaimer travels inside it (memo §c), with the revision pinned. */
export interface RegimeCrosswalkExport {
  readonly regime: RegimeId;
  readonly title: string;
  readonly regimeRevision: string;
  readonly crosswalkVersion: string;
  readonly disclaimer: RegimeCrosswalkDisclaimer;
  readonly rows: readonly RegimeCrosswalkRow[];
}

/**
 * Export a regime crosswalk to its delivery artifact (ADR-0277). Pure + deterministic (static authored
 * data, no clock, no ids), so it is golden-fixtured and drops straight into the ADR-0275 evidence pack.
 * The disclaimer block — shared scope language + the regime's own sentence + the pinned revision — is
 * embedded IN the returned object, so a reviewer opening the artifact cold (no site chrome) sees it.
 * Un-wired seam (ADR-0047 ethos): returns the object; a caller serializes/archives it — no file write.
 */
export function exportRegimeCrosswalk(
  crosswalk: RegimeCrosswalk,
): RegimeCrosswalkExport {
  return {
    regime: crosswalk.regime,
    title: crosswalk.title,
    regimeRevision: crosswalk.regimeRevision,
    crosswalkVersion: crosswalk.crosswalkVersion,
    disclaimer: {
      notACertification: NOT_A_CERTIFICATION,
      noComplianceGuarantee: NO_COMPLIANCE_GUARANTEE,
      claimLegend: CLAIM_LEGEND,
      scopeBoundary: SCOPE_BOUNDARY,
      regimeSpecific: crosswalk.regimeSpecificDisclaimer,
      regimeRevision: crosswalk.regimeRevision,
    },
    rows: crosswalk.rows,
  };
}
