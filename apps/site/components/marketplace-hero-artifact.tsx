import type { IconName } from "@caisson/ui/components";

import { Icon } from "@/components";
import { requireBundlePage } from "@/lib/bundle-pages";
import { BUNDLE_MARKS, moduleMark } from "@/lib/marks";
import { type BundleId, BUNDLES } from "@/lib/catalog";

import { MediaFrame } from "./media-frame";
import styles from "./marketplace-hero-artifact.module.css";

// The marketplace hero's right-half artifact (ADR-0285 one-surface framing), plus its ADR-0290
// parametrization: the SAME composition pattern — chips composing onto ONE Apache-2.0 audited base —
// renders either the whole catalog (the hero, all six bundles) or a single bundle's real member
// modules (a bundle's media-carousel slide, closing the "4 media-less bundles" gap with one
// component). Server-safe and presentational; the hero's chips derive from BUNDLES and a bundle's
// slide chips derive from bundle-pages.ts's real member list (never MODULES — see the
// BundleCompositionSlide doc comment below), so neither can drift from the real catalog. No external assets — every glyph is an inline kit
// <Icon> (the site CSP blocks remote hosts).
//
// The base-slab capabilities are hand-picked marketing labels for packages in the open Apache-2.0
// substrate (BASE_PACKAGES, apps/site/lib/base-substrate.ts) — BASE_FACTS is a local literal, not
// imported from that file, so keep the two in sync by hand. They match the homepage's
// honest-artifact floor (ADR-0082). WORM/audit-chain/metering are commercial-package capabilities
// (audit-worm/ai-meter), NOT part of the free base — an audit-round F2 finding (ADR-0374) against
// the prior list.
const BASE_FACTS = [
  "Postgres RLS",
  "auth + orgs",
  "billing seams",
  "typed migrations",
] as const;

interface ComposeItem {
  key: string;
  mark: IconName;
  label: string;
}

function ComposeBody({ items }: { items: readonly ComposeItem[] }) {
  return (
    <div className={styles.body}>
      <ul className={styles.bundles}>
        {items.map((it) => (
          <li key={it.key} className={styles.bundle}>
            <Icon name={it.mark} />
            <span className={styles.bundleLabel}>{it.label}</span>
          </li>
        ))}
      </ul>

      <div className={styles.connector}>
        <span className={styles.connectorLine} />
        <span className={styles.connectorLabel}>compose onto</span>
        <span className={styles.connectorLine} />
      </div>

      <div className={styles.base}>
        <span className={styles.baseHead}>
          <Icon name="check" />
          Apache-2.0 audited base
        </span>
        <span className={styles.baseFacts}>{BASE_FACTS.join(" · ")}</span>
      </div>
    </div>
  );
}

/** The whole-catalog composition — the marketplace hero's right-half artifact: every SELLABLE
 *  bundle composing onto the base. Also reused as the Everything bundle's media slide (ADR-0290).
 *  Everything itself is excluded from its own chip list (it is the whole-catalog purchase, not one
 *  more thing composing onto the base alongside the five it contains) — the count and the rendered
 *  chips both come from the same filtered array, so they can't drift apart (ADR-0082 F6). */
export function MarketplaceHeroArtifact() {
  const bundles = BUNDLES.filter((b) => b.id !== "everything");
  const items: readonly ComposeItem[] = bundles.map((b) => ({
    key: b.id,
    mark: BUNDLE_MARKS[b.id],
    label: b.label,
  }));
  return (
    <MediaFrame
      // "+ Everything": the page's own lede and type facet count six bundles (Everything
      // included as a SKU); a bare "5 composable bundles" read as a contradiction two
      // lines below "six bundles" (post-deploy re-audit, high). The chip list stays 5 —
      // Everything is the whole-catalog purchase, not a sixth thing composing alongside
      // the five it contains — so the label names it instead of counting it.
      label={`caisson · one base, ${bundles.length} composable bundles + Everything`}
      ariaLabel={`${bundles.length} composable Caisson bundles onto one Apache-2.0 audited base, plus the Everything bundle covering all of them`}
      status={
        <span className={styles.barChip}>
          <span className={styles.dot} />
          composable
        </span>
      }
      decorative
    >
      <ComposeBody items={items} />
    </MediaFrame>
  );
}

/** A single bundle's composition slide (ADR-0290) — the same pattern, parametrized: that bundle's
 *  real member modules composing onto the base. Members come from `bundle-pages.ts` (the same
 *  record the bundle's own marketing page renders its "N composed packages" heading from), NOT
 *  `catalog.ts`'s `modulesByBundle` — that only returns modules with a standalone SKU, undercounting
 *  a bundle that also includes unpriced base packages (e.g. Compliance ships 14 composed packages,
 *  11 of them separately priced), which drifted this diagram's count from the page's own copy.
 *  `everything` has no per-module `members[]` (it is the whole catalog by construction) so it
 *  reuses <MarketplaceHeroArtifact> itself rather than rendering an empty or all-27-modules list. */
export function BundleCompositionSlide({ bundleId }: { bundleId: BundleId }) {
  if (bundleId === "everything") return <MarketplaceHeroArtifact />;

  const bundle = BUNDLES.find((b) => b.id === bundleId);
  const label = bundle?.label ?? bundleId;
  const members = requireBundlePage(bundleId).members;
  const items: readonly ComposeItem[] = members.map((m) => ({
    key: m.id,
    mark: moduleMark(m.id),
    label: m.name,
  }));

  return (
    <MediaFrame
      label={`${label} · ${members.length} package${members.length === 1 ? "" : "s"}`}
      ariaLabel={`${label} bundle: ${members.map((m) => m.name).join(", ")}. Composing onto one Apache-2.0 audited base.`}
      status={
        <span className={styles.barChip}>
          <span className={styles.dot} />
          composes
        </span>
      }
      decorative
    >
      <ComposeBody items={items} />
    </MediaFrame>
  );
}
