import type { ReactNode } from "react";

import { adminDbConfigured, readAdmin } from "@/lib/admin-db";
import {
  INTEL_SEVERITIES,
  INTEL_SOURCES,
  INTEL_STATUSES,
  isIntelSeverity,
  isIntelSource,
  isIntelStatus,
  readIntelFindings,
  type IntelFindingFilter,
  type IntelFindingRow,
  type IntelStatus,
} from "@/lib/intel-read";

import { TriageControls } from "./triage-controls";

// ADR-0286 — the admin intel findings page. The standing intel daemon (services/intel) has been
// writing findings into the admin database's `intel` schema; until now nothing rendered them, so
// every finding was invisible without raw SQL (per the ADR, this page was deliberately sequenced
// AFTER the OAuth + catalog merge queue drained — it has). Reads run through the SAME read-only
// `admin` role every other business-admin view uses.
export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

// ADR-0316 F5 — findings now carry a triage lifecycle (open → reviewed | dismissed). The page
// DEFAULTS to `status=open` so triaged findings drop off the wall; the Status filter's "All" option
// (empty value) shows every state. Per-row Review/Dismiss buttons POST to the dual-logged
// review/dismiss routes.
export default async function IntelPage({
  searchParams,
}: {
  searchParams: Promise<{
    severity?: string;
    source?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const severity =
    params.severity !== undefined && isIntelSeverity(params.severity)
      ? params.severity
      : undefined;
  const source =
    params.source !== undefined && isIntelSource(params.source)
      ? params.source
      : undefined;
  // Default to `open` on first load (no status param); an explicit empty value ("All") clears it.
  const rawStatus = params.status;
  const status: IntelStatus | undefined =
    rawStatus === undefined
      ? "open"
      : isIntelStatus(rawStatus)
        ? rawStatus
        : undefined;
  // What the Status <select> shows: the resolved status, or "" ("All") when it was explicitly cleared.
  const statusSelectValue =
    rawStatus === undefined
      ? "open"
      : isIntelStatus(rawStatus)
        ? rawStatus
        : "";

  const filter: IntelFindingFilter = {
    ...(severity === undefined ? {} : { severity }),
    ...(source === undefined ? {} : { source }),
    ...(status === undefined ? {} : { status }),
  };
  const configured = adminDbConfigured();
  const findings: IntelFindingRow[] = configured
    ? await readAdmin((tx) => readIntelFindings(tx, filter))
    : [];

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin</p>
        <h1 className="page-title">Intel findings</h1>
        <p className="lede">
          Competitor, compliance-framework, GitHub-traction, analytics, and
          error-triage findings from the standing intel daemon, newest first.
          Read-only, through the same <span className="mono">admin</span> role
          as every other business-admin view.
        </p>
      </section>

      {!configured ? (
        <div className="panel">
          <p className="section-title">Not configured</p>
          <p className="muted">
            Set <span className="mono">CAISSON_ADMIN_DB_URL</span> to read live
            findings. The intel daemon writes to the same admin Postgres, in its
            own <span className="mono">intel</span> schema.
          </p>
        </div>
      ) : null}

      <form
        method="GET"
        className="row"
        style={{ gap: "var(--cs-space-3)", flexWrap: "wrap" }}
      >
        <Select
          name="severity"
          label="Severity"
          value={severity ?? ""}
          options={INTEL_SEVERITIES}
        />
        <Select
          name="source"
          label="Source"
          value={source ?? ""}
          options={INTEL_SOURCES}
        />
        <Select
          name="status"
          label="Status"
          value={statusSelectValue}
          options={INTEL_STATUSES}
        />
        <button
          type="submit"
          style={{ alignSelf: "flex-end", padding: "6px 12px" }}
        >
          Filter
        </button>
        {severity !== undefined ||
        source !== undefined ||
        statusSelectValue !== "open" ? (
          <a
            href="/intel"
            className="muted"
            style={{ alignSelf: "flex-end", fontSize: "0.85em" }}
          >
            Clear
          </a>
        ) : null}
      </form>

      <Section title={`Findings (${findings.length})`}>
        <Table
          head={[
            "Severity",
            "Source",
            "Title",
            "Seen",
            "Last seen",
            "Status",
            "Triage",
          ]}
          textColumns={[0, 1, 3, 4, 5]}
          empty={configured ? "No findings match this filter." : "—"}
          rows={findings.map((f) => [
            f.severity,
            f.source,
            f.title,
            String(f.seenCount),
            fmtDate(f.lastSeen),
            f.status,
            <TriageControls key={f.id} findingId={f.id} status={f.status} />,
          ])}
        />
      </Section>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly string[];
}) {
  return (
    <label className="stack" style={{ gap: 4 }}>
      <span className="muted" style={{ fontSize: "0.8em" }}>
        {label}
      </span>
      <select name={name} defaultValue={value} style={{ padding: 6 }}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: "var(--cs-space-3)" }}>
      <h2 className="section-title">{title}</h2>
      <div className="panel">{children}</div>
    </section>
  );
}

function Table({
  head,
  rows,
  empty,
  textColumns,
}: {
  head: string[];
  rows: ReactNode[][];
  empty: string;
  /** Column indices rendered in the mono class (the rest render plain — e.g. Title + the Triage
   *  control column). */
  textColumns?: number[];
}) {
  if (rows.length === 0) {
    return <p className="muted">{empty}</p>;
  }
  const mono = new Set(textColumns ?? []);
  return (
    <table className="admin-table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className={mono.has(j) ? "mono" : undefined}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
