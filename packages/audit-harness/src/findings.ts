/**
 * Cross-domain reconciling ledger (ADR-0134 §2). Generalizes `tooling/design-critic/src/findings.ts`
 * from design-only to EVERY declared domain (./domains.ts) — one append-only ledger instead of N
 * siloed reports, so a security finding and a design finding reconcile against the same source of
 * truth. The reconcile/stable-id/status semantics are UNCHANGED from design-critic:
 *
 *   - id = sha256(domain ∷ subject ∷ normalized-title)[:16] — rewording a title never forks a finding.
 *   - reconcile() classifies every id this run: new / unchanged / regressed / closed. A fixed
 *     finding that REAPPEARS flips to `regressed`; an operator-`accepted` finding keeps that status
 *     while it persists; a finding that DISAPPEARS flips to `fixed` (class `closed`).
 *
 * This is strictly NON-BLOCKING (ADR-0134 Rejected #3): a finding here never gates a commit. Only a
 * `severity: "high"` finding is eligible for the `/validate` escalation in ./validate.ts.
 *
 * v2 (ADR-0233): the id gains the `dimension` axis (`sha256(domain ∷ dimension ∷ subject ∷
 * normalized-title)`), and `reconcile()` fails loud on an id collision or an out-of-universe domain
 * instead of silently dropping a finding — the two silent-loss classes v1's round-5 critic caught.
 */
import { createHash } from "node:crypto";

export type FindingStatus = "open" | "accepted" | "fixed";
export type FindingSeverity = "info" | "warn" | "high";

export interface Finding {
  /** stable, derived — see stableId(). */
  id: string;
  /** the declared audit domain (./domains.ts `Domain.id`), e.g. "packages/kernel", "apps/admin". */
  domain: string;
  /** the audit lens (./dimensions.ts `Dimension.id`), e.g. "D1".."D7". Part of the stable id. */
  dimension: string;
  /** the file/component/subject under audit (e.g. a path, a package name, a screen). */
  subject: string;
  /** human title; may be reworded run-to-run without forking the id. */
  title: string;
  severity: FindingSeverity;
  status: FindingStatus;
}

/** A freshly-emitted finding before reconcile assigns an id + resolves its status. */
export type RawFinding = Omit<Finding, "id" | "status"> & {
  status?: FindingStatus;
};

export type ReconcileClass = "new" | "unchanged" | "regressed" | "closed";

export interface ReconcileResult {
  /** the merged ledger to persist (sorted by id). */
  ledger: Finding[];
  /** per-id classification for THIS run. */
  classes: Record<string, ReconcileClass>;
}

/** Normalize a title for identity: lowercase, punctuation→space, collapse whitespace. */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Stable ID = sha256(domain ∷ dimension ∷ subject ∷ normalized-title)[:16]. The `dimension` input
 * (ADR-0233) keeps a security finding and a customer-facing finding on the SAME file+title from
 * collapsing to one id. */
export function stableId(
  domain: string,
  dimension: string,
  subject: string,
  title: string,
): string {
  return createHash("sha256")
    .update(`${domain}∷${dimension}∷${subject}∷${normalizeTitle(title)}`)
    .digest("hex")
    .slice(0, 16);
}

/** Attach the derived id (+ default status) to a raw finding. */
export function withId(f: RawFinding): Finding {
  return {
    ...f,
    status: f.status ?? "open",
    id: stableId(f.domain, f.dimension, f.subject, f.title),
  };
}

/**
 * Reconcile a fresh audit run against the persisted ledger. Pure: no IO, deterministic.
 *
 * `scope` = the domains ACTUALLY audited this run (ADR-0188 / F4). Only a finding whose
 * `domain ∈ scope` is eligible for the new/closed transitions; every previous finding in an
 * UN-audited domain passes through UNCHANGED. Without this, a domain-by-domain run silently
 * marks every open finding in the domains it didn't touch as `fixed` (the must-fix false-close).
 * Scope is an explicit required argument, never inferred from `current` — a domain that was
 * audited but produced zero findings must still be in scope so its stale findings close.
 *
 *  - present this run, absent before        → `new`        (status open)
 *  - present this run, was `fixed` before    → `regressed`  (status open — it came back)
 *  - present this run, was open/accepted      → `unchanged`  (status PRESERVED — operator triage sticks)
 *  - absent this run, in scope, was open/accepted → `closed`  (status fixed)
 *  - absent this run, OUT of scope            → passed through unchanged (NOT closed)
 *  - absent this run, was already `fixed`     → carried forward, no class (stays closed)
 *
 * Fail-loud (ADR-0233), three ways — a caller inconsistency aborts instead of silently losing a
 * finding:
 *  - a `current` finding whose domain ∉ `scope` throws (the domain produced a finding, so it WAS
 *    audited, so `scope` is wrong);
 *  - two distinct `current` findings that share an id throw (an id COLLISION — v1 kept one and
 *    dropped the other silently; the round-5 name-collision class);
 *  - when `validDomains` is supplied (the ./domains.ts `deriveDomains()` universe), a `current`
 *    finding whose domain ∉ that universe throws (a mislabeled domain — e.g. "audit-harness" typed
 *    for "audit-worm" — aborts the run instead of misattributing).
 */
export function reconcile(
  previous: Finding[],
  current: RawFinding[],
  scope: readonly string[],
  validDomains?: ReadonlySet<string>,
): ReconcileResult {
  const inScope = new Set(scope);
  const prev = new Map(previous.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const ledger: Finding[] = [];
  const classes: Record<string, ReconcileClass> = {};

  for (const raw of current) {
    const f = withId(raw);
    if (validDomains && !validDomains.has(f.domain)) {
      throw new Error(
        `reconcile: finding "${f.title}" is in domain "${f.domain}" which is not a derived domain (deriveDomains()) — a mislabeled domain, not an audited surface.`,
      );
    }
    if (!inScope.has(f.domain)) {
      throw new Error(
        `reconcile: finding "${f.title}" is in domain "${f.domain}" but that domain is not in the audited scope [${[...inScope].join(", ")}] — declare it in --domains.`,
      );
    }
    if (seen.has(f.id)) {
      throw new Error(
        `reconcile: id collision on "${f.id}" — two distinct findings normalize to the same (domain ∷ dimension ∷ subject ∷ title) key (e.g. "${f.domain}"/"${f.dimension}"/"${f.subject}"). Refusing to silently drop one; disambiguate a title or split the subject.`,
      );
    }
    seen.add(f.id);
    const p = prev.get(f.id);
    if (!p) {
      classes[f.id] = "new";
      ledger.push({ ...f, status: "open" });
    } else if (p.status === "fixed") {
      classes[f.id] = "regressed";
      ledger.push({ ...f, status: "open" });
    } else {
      classes[f.id] = "unchanged";
      ledger.push({ ...f, status: p.status });
    }
  }
  for (const p of previous) {
    if (seen.has(p.id)) continue;
    // The fix: a previous finding in a domain we did NOT audit this run is passed through
    // untouched — reconciling only closes findings inside the audited scope.
    if (!inScope.has(p.domain)) {
      ledger.push(p);
      continue;
    }
    if (p.status === "fixed") {
      ledger.push(p);
    } else {
      classes[p.id] = "closed";
      ledger.push({ ...p, status: "fixed" });
    }
  }
  ledger.sort((a, b) => a.id.localeCompare(b.id));
  return { ledger, classes };
}

// ── minimal TOML round-trip for the constrained `[[finding]]` array-of-tables schema ──────────────
// Hand-rolled (no dep): every field is a quoted scalar string, so a tiny parser/serializer is exact
// and deterministic. NOT a general TOML implementation — only this ledger's shape.

const esc = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const unesc = (s: string): string =>
  s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");

const LEDGER_HEADER = `# audit-harness cross-domain findings ledger — ADR-0134/0233 (ADVISORY, never blocks a merge).
# Stable id = sha256(domain ∷ dimension ∷ subject ∷ normalized-title)[:16]. status: open | accepted | fixed.
# Regenerated by reconcile(); the operator hand-edits ONLY \`status\` (open→accepted to triage a finding).
`;

export function serializeFindings(ledger: Finding[]): string {
  const tables = [...ledger]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (f) =>
        `[[finding]]\n` +
        `id = "${f.id}"\n` +
        `domain = "${esc(f.domain)}"\n` +
        `dimension = "${esc(f.dimension)}"\n` +
        `subject = "${esc(f.subject)}"\n` +
        `title = "${esc(f.title)}"\n` +
        `severity = "${f.severity}"\n` +
        `status = "${f.status}"\n`,
    );
  return `${LEDGER_HEADER}\n${tables.join("\n")}`;
}

const isSeverity = (s: string): s is FindingSeverity =>
  s === "info" || s === "warn" || s === "high";
const isStatus = (s: string): s is FindingStatus =>
  s === "open" || s === "accepted" || s === "fixed";

export function parseFindings(toml: string): Finding[] {
  const out: Finding[] = [];
  let cur: Record<string, string> | null = null;
  const flush = (): void => {
    const c = cur;
    cur = null;
    if (!c) return;
    const { id, domain, dimension, subject, title, severity, status } = c;
    // Truthy-narrow every required field (noUncheckedIndexedAccess → each is string | undefined).
    if (id && domain && dimension && subject && title && severity && status) {
      // Fail loud on a corrupt/hand-edited ledger row instead of silently casting an unknown enum
      // value through — consistent with reconcile()'s fail-loud stance on the same ledger.
      if (!isSeverity(severity)) {
        throw new Error(
          `parseFindings: finding "${id}" has unknown severity "${severity}" (expected info|warn|high).`,
        );
      }
      if (!isStatus(status)) {
        throw new Error(
          `parseFindings: finding "${id}" has unknown status "${status}" (expected open|accepted|fixed).`,
        );
      }
      out.push({ id, domain, dimension, subject, title, severity, status });
    }
  };
  for (const lineRaw of toml.split("\n")) {
    const line = lineRaw.trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line === "[[finding]]") {
      flush();
      cur = {};
      continue;
    }
    const m = line.match(/^(\w+)\s*=\s*"(.*)"$/);
    if (m && cur && m[1] !== undefined && m[2] !== undefined)
      cur[m[1]] = unesc(m[2]);
  }
  flush();
  return out;
}
