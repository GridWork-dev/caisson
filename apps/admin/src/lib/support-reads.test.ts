// ADR-0316 W-SUPPORT — readSupportTickets on PGlite via @caisson/testing. Seeds directly into
// support_ticket (mirroring the bot's SUPPORT_TICKET_SCHEMA + the DEPLOY grant) and reads as the
// read-only `admin` role — the same seam the /support page uses.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { TenantExecutor, Transactor } from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";

import {
  readSupportTickets,
  supportTableUnavailable,
} from "./support-reads.ts";

// Byte-mirror of services/support-bot/.../escalation.py SUPPORT_TICKET_SCHEMA (test double only).
const SUPPORT_TICKET_SCHEMA = `
CREATE TABLE IF NOT EXISTS support_ticket (
    id                text        PRIMARY KEY,
    question          text        NOT NULL,
    ai_brief          jsonb       NOT NULL,
    status            text        NOT NULL DEFAULT 'open',
    discord_thread_id bigint,
    created_at        timestamptz NOT NULL DEFAULT now(),
    priority          boolean     NOT NULL DEFAULT false
);
`;
// The operator-gated DEPLOY grant this whole wave depends on (see DEPLOY notes).
const SUPPORT_TICKET_ADMIN_GRANT = `GRANT SELECT ON support_ticket TO admin;`;

let tp: TestPg;
let db: Transactor;

async function asAdmin<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE admin`);
    return fn(tx);
  });
}

async function seedTicket(o: {
  id: string;
  question: string;
  summary: string;
  status?: string;
  priority?: boolean;
  discordThreadId?: number | null;
  createdAt?: string;
}): Promise<void> {
  await tp.query(
    `INSERT INTO support_ticket (id, question, ai_brief, status, discord_thread_id, priority, created_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, COALESCE($7::timestamptz, now()))`,
    [
      o.id,
      o.question,
      JSON.stringify({ question: o.question, summary: o.summary }),
      o.status ?? "open",
      o.discordThreadId ?? null,
      o.priority ?? false,
      o.createdAt ?? null,
    ],
  );
}

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN CREATE ROLE admin NOLOGIN; END IF;
  END $$;`);
  await tp.exec(SUPPORT_TICKET_SCHEMA);
  await tp.exec(SUPPORT_TICKET_ADMIN_GRANT);
});

afterAll(async () => {
  await tp.close();
});

describe("readSupportTickets (ADR-0316 W-SUPPORT)", () => {
  test("orders priority-first then newest, and maps every field", async () => {
    await seedTicket({
      id: "t1",
      question: "old low-pri",
      summary: "old low",
      createdAt: "2026-01-01T00:00:00Z",
    });
    await seedTicket({
      id: "t2",
      question: "new low-pri",
      summary: "new low",
      discordThreadId: 100200300,
      createdAt: "2026-03-01T00:00:00Z",
    });
    await seedTicket({
      id: "t3",
      question: "urgent",
      summary: "urgent reason",
      priority: true,
      discordThreadId: null,
      createdAt: "2026-02-01T00:00:00Z",
    });

    const rows = await asAdmin((tx) => readSupportTickets(tx));
    const ids = rows.map((r) => r.id);
    // priority t3 first (even though older), then newest low-pri t2, then oldest t1.
    expect(ids.indexOf("t3")).toBeLessThan(ids.indexOf("t2"));
    expect(ids.indexOf("t2")).toBeLessThan(ids.indexOf("t1"));

    const t3 = rows.find((r) => r.id === "t3");
    expect(t3?.priority).toBe(true);
    expect(t3?.summary).toBe("urgent reason");
    expect(t3?.discordThreadId).toBeNull();

    const t2 = rows.find((r) => r.id === "t2");
    expect(t2?.priority).toBe(false);
    expect(t2?.discordThreadId).toBe("100200300"); // bigint → string
    expect(t2?.summary).toBe("new low");
    expect(typeof t2?.createdAt).toBe("string");
  });
});

describe("supportTableUnavailable guard", () => {
  test("classifies 42P01 / 42501 and passes everything else through as null", () => {
    expect(supportTableUnavailable({ code: "42P01" })).toBe("missing");
    expect(supportTableUnavailable({ code: "42501" })).toBe("forbidden");
    expect(supportTableUnavailable({ code: "08006" })).toBeNull(); // transient conn error
    expect(supportTableUnavailable(new Error("boom"))).toBeNull();
    expect(supportTableUnavailable(null)).toBeNull();
    expect(supportTableUnavailable("nope")).toBeNull();
  });
});
