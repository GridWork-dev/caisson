// Question-capture tests over the in-memory PGlite double (ADR-0236). Verifies the record shape
// (anonymous by construction) and that the 90-day retention sweep hard-deletes expired rows on insert.
import { beforeAll, expect, test } from "bun:test";
import { getDb } from "../db.ts";
import { logQuestion } from "./question-log.ts";

beforeAll(() => {
  delete process.env.DATABASE_URL;
  const g = globalThis as unknown as {
    caissonTransactor?: unknown;
    caissonPglite?: unknown;
  };
  g.caissonTransactor = undefined;
  g.caissonPglite = undefined;
});

test("logQuestion records lane, text, and outcome", async () => {
  const db = await getDb();
  await logQuestion(
    db,
    "public",
    "does the WORM log survive restarts?",
    "answered",
  );
  await logQuestion(db, "premium", "how do I rotate a BYOK key?", "escalated");

  const rows = await db.transaction(async (tx) => {
    const res = await tx.query<{
      lane: string;
      question: string;
      outcome: string;
    }>("SELECT lane, question, outcome FROM ask_ai_question ORDER BY id");
    return res.rows;
  });
  expect(rows).toEqual([
    {
      lane: "public",
      question: "does the WORM log survive restarts?",
      outcome: "answered",
    },
    {
      lane: "premium",
      question: "how do I rotate a BYOK key?",
      outcome: "escalated",
    },
  ]);
});

test("insert sweeps rows past the 90-day retention window (hard DELETE)", async () => {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO ask_ai_question (created_at, lane, question, outcome)
       VALUES (now() - interval '91 days', 'public', 'stale question', 'answered')`,
      [],
    );
  });

  await logQuestion(db, "public", "fresh question", "answered");

  const stale = await db.transaction(async (tx) => {
    const res = await tx.query<{ n: string | number }>(
      "SELECT count(*) AS n FROM ask_ai_question WHERE question = 'stale question'",
      [],
    );
    return Number(res.rows[0]?.n);
  });
  expect(stale).toBe(0);
});
