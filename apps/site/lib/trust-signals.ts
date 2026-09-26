import { BASE_PACKAGES } from "@/lib/base-substrate";
import { CHANGELOG_ENTRIES } from "@/lib/changelog";
import { source } from "@/lib/source";
import type { IconName } from "@caisson/ui/components";

// The truthful-signals block (ADR-0374 lock 2, audit Q1) — three real, computed facts shown on
// the gallery surfaces (the bundle popout + the marketplace page). Never a hand-typed number: every
// label derives from the same data the rest of the site already renders, so this can't drift into
// a fabricated claim (ADR-0082/0237 truth floor). One shared source so both consumers agree.

export interface TruthfulSignal {
  readonly key: "open-base" | "docs-depth" | "build-state";
  readonly label: string;
  readonly icon: IconName;
  readonly href: string;
}

const STALE_AFTER_DAYS = 90;

function formatDateUTC(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** SERVER-ONLY: reads the Fumadocs source tree. Compute in a Server Component (the marketplace
 *  page) and pass the result down as a prop — never import this file from a "use client" module
 *  (it would pull docs content resolution into the client bundle for no reason). */
export function truthfulSignals(): readonly TruthfulSignal[] {
  const latest = CHANGELOG_ENTRIES[0];
  const daysSinceLatest = latest
    ? (Date.now() - Date.parse(latest.date)) / 86_400_000
    : Infinity;
  // Word choice: "Latest update," not "latest release" — ChangelogEntry.version is optional, so
  // "release" would overclaim a versioned artifact on an entry that might not carry one. Past the
  // freshness gate the claim quietly drops to a still-true, un-dated form rather than advertising
  // dormancy as freshness.
  const buildStateLabel =
    latest && daysSinceLatest <= STALE_AFTER_DAYS
      ? `Latest update ${formatDateUTC(latest.date)}`
      : "Dated release history";

  return [
    {
      key: "open-base",
      label: `Apache-2.0 base, ${BASE_PACKAGES.length} packages`,
      icon: "scale",
      href: "/docs/base",
    },
    {
      key: "build-state",
      label: buildStateLabel,
      icon: "git-branch",
      href: "/updates",
    },
    {
      key: "docs-depth",
      label: `${source.getPages().length} pages of documentation`,
      icon: "book",
      href: "/docs",
    },
  ] as const;
}
