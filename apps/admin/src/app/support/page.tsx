import type { ReactNode } from "react";

import { EmptyState, Icon } from "@caisson/ui/components";

import { adminDbConfigured, readAdmin } from "@/lib/admin-db";
import { fetchLatestServiceLine, lokiConfigured } from "@/lib/loki";
import type { LogLine } from "@/lib/loki";
import {
  readSupportTickets,
  supportTableUnavailable,
  type SupportTicketRow,
} from "@/lib/support-reads";

// ADR-0105/0206/0316 W-SUPPORT — the support health cockpit. Three reads, all degrade-clean:
// (1) the support-bot escalation list (`support_ticket`) through the read-only `admin` role, guarded
// for a missing table (42P01) or a missing grant (42501) into an EmptyState — the table + its
// GRANT SELECT are operator-gated DEPLOY steps; (2) bot liveness = the most recent support-bot line
// from Grafana Cloud Loki (lib/loki.ts), dormant when the log datasource env is unset; (3) a static
// link to the Linear Triage view, where the bot files each escalation as a third best-effort sink.
export const dynamic = "force-dynamic";

const SUPPORT_BOT_SERVICE = "service-support-bot"; // telemetry.py's OTEL service.name
const LINEAR_TRIAGE_URL = "https://linear.app/gridwork/team/CAISSON/triage";

type TicketStatus = "ok" | "missing" | "forbidden" | "error";

async function loadTickets(): Promise<{
  rows: SupportTicketRow[];
  status: TicketStatus;
}> {
  if (!adminDbConfigured()) return { rows: [], status: "ok" };
  try {
    const rows = await readAdmin(readSupportTickets);
    return { rows, status: "ok" };
  } catch (err) {
    // 42P01/42501 = the DEPLOY DDL/grant hasn't run yet (honest EmptyState); anything else is a
    // transient DB error and must NOT read as "not provisioned" (CAISSON-10 pattern, see /business).
    return { rows: [], status: supportTableUnavailable(err) ?? "error" };
  }
}

/** Parse either an ISO string or a node-pg Date-string into a stable `YYYY-MM-DD HH:MM:SS`. */
function fmtWhen(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v.slice(0, 19)
    : d.toISOString().replace("T", " ").slice(0, 19);
}

function fmtAge(tsMs: number, nowMs: number): string {
  if (tsMs <= 0) return "—";
  const s = Math.max(0, Math.round((nowMs - tsMs) / 1000));
  if (s < 60) return `${String(s)}s ago`;
  if (s < 3600) return `${String(Math.round(s / 60))}m ago`;
  return `${String(Math.round(s / 3600))}h ago`;
}

export default async function SupportPage() {
  const configured = adminDbConfigured();
  const [tickets, botLine] = await Promise.all([
    loadTickets(),
    fetchLatestServiceLine(SUPPORT_BOT_SERVICE),
  ]);
  const lokiOn = lokiConfigured();

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin / support</p>
        <h1 className="page-title">Support health</h1>
        <p className="lede">
          Support-bot escalations, bot liveness, and the Linear Triage inbox, in
          one place. Escalations read through the same read-only{" "}
          <span className="mono">admin</span> role as every other business-admin
          view; liveness reads Grafana Cloud Loki (ADR-0206/0316).
        </p>
      </section>

      {!configured ? (
        <div className="panel">
          <p className="section-title">Not configured</p>
          <p className="muted">
            Set <span className="mono">CAISSON_ADMIN_DB_URL</span> to read live
            escalations. The support-bot writes{" "}
            <span className="mono">support_ticket</span> rows to the same admin
            Postgres.
          </p>
        </div>
      ) : null}

      <section className="stack" style={{ gap: "var(--cs-space-3)" }}>
        <h2 className="section-title">Bot liveness</h2>
        <div className="panel">
          <BotLiveness lokiOn={lokiOn} line={botLine} />
        </div>
      </section>

      <Section
        title={
          // Root cause (ADR-0374 [high]): a failed read must never assert a count — "(0)" reads
          // as "confirmed zero escalations," which is false when the read itself failed.
          tickets.status === "ok"
            ? `Escalations (${String(tickets.rows.length)})`
            : "Escalations"
        }
      >
        <Escalations status={tickets.status} rows={tickets.rows} />
      </Section>

      <section className="stack" style={{ gap: "var(--cs-space-3)" }}>
        <h2 className="section-title">Triage inbox</h2>
        <div className="panel stack" style={{ gap: "var(--cs-space-3)" }}>
          <p className="muted">
            Each escalation is also filed as a Linear Triage issue (a
            best-effort third sink, ADR-0206). Triage, assign, and delegate a
            first pass to the Linear Agent there.
          </p>
          <a
            className="btn"
            href={LINEAR_TRIAGE_URL}
            target="_blank"
            rel="noreferrer noopener"
            style={{ alignSelf: "flex-start" }}
          >
            <Icon name="arrow" /> Open Linear Triage
          </a>
        </div>
      </section>
    </div>
  );
}

function BotLiveness({
  lokiOn,
  line,
}: {
  lokiOn: boolean;
  line: LogLine | null;
}) {
  if (!lokiOn) {
    return (
      <EmptyState
        icon="server"
        title="Log backend not configured"
        description="Set GRAFANA_LOKI_DATASOURCE_UID (with the GRAFANA_URL / GRAFANA_QUERY_TOKEN already used for traces) to read support-bot liveness from Grafana Cloud Loki."
      />
    );
  }
  if (line === null) {
    return (
      <EmptyState
        icon="server"
        title="No recent support-bot log line"
        description="No stream in the last 6 hours — the bot hasn't been redeployed since its OTLP log export shipped (2026-07-10), or it isn't logging. Railway logs remain its fallback log home until the stream appears."
      />
    );
  }
  return (
    <div className="stack" style={{ gap: "var(--cs-space-2)" }}>
      <p
        className="row"
        style={{ gap: "var(--cs-space-2)", alignItems: "center" }}
      >
        <span className="board-glyph" data-state="ready">
          <Icon name="server" />
        </span>
        <span>
          Last log line <strong>{fmtAge(line.tsMs, Date.now())}</strong>
          {line.level !== undefined ? (
            <span className="muted"> · {line.level}</span>
          ) : null}
        </span>
      </p>
      <p className="mono muted" style={{ fontSize: "0.85em" }}>
        {line.line.length > 400 ? `${line.line.slice(0, 400)}…` : line.line}
      </p>
    </div>
  );
}

function Escalations({
  status,
  rows,
}: {
  status: TicketStatus;
  rows: SupportTicketRow[];
}) {
  if (status === "missing") {
    return (
      <p className="muted">
        The <span className="mono">support_ticket</span> table is not
        provisioned yet — run the support-bot DEPLOY DDL (its{" "}
        <span className="mono">SUPPORT_TICKET_SCHEMA</span>) and{" "}
        <span className="mono">GRANT SELECT ON support_ticket TO admin</span>.
      </p>
    );
  }
  if (status === "forbidden") {
    return (
      <p className="muted">
        The read-only <span className="mono">admin</span> role lacks SELECT on{" "}
        <span className="mono">support_ticket</span>. Run{" "}
        <span className="mono">GRANT SELECT ON support_ticket TO admin</span> as
        a DEPLOY step.
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="muted row" style={{ gap: "var(--cs-space-3)" }}>
        <span>
          Escalations could not be read right now: a transient database error,
          not a missing table.
        </span>
        {/* A plain nav link (this is a server component) so "reload" is a real control, not just
         *  copy asking the operator to hit their browser's own reload (ADR-0374 [warn]). */}
        <a className="btn ghost" href="/support">
          Reload
        </a>
      </p>
    );
  }
  if (rows.length === 0) {
    return <p className="muted">No escalations yet.</p>;
  }
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Pri</th>
          <th>Status</th>
          <th>Question</th>
          <th>Why escalated</th>
          <th>When</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.priority ? "●" : "—"}</td>
            <td className="mono">{r.status}</td>
            <td>{r.question}</td>
            <td className="muted">{r.summary ?? "—"}</td>
            <td className="mono">{fmtWhen(r.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
