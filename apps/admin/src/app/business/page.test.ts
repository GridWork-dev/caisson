// CAISSON-10: proves the /business degrade path's guard actually distinguishes a genuine
// undefined-table error (42P01 — "the ADR-0220 DDL hasn't run yet") from any other DB error (a
// transient connection drop, a timeout). Before this fix a blanket `catch {}` treated every error
// the same, so a transient failure rendered the "not provisioned" hint even though the table exists.
import { expect, test } from "bun:test";
import { isUndefinedTableError } from "./page.tsx";

test("a genuine undefined-table error (42P01) is recognized", () => {
  const err = Object.assign(
    new Error('relation "admin_action_log" does not exist'),
    {
      code: "42P01",
    },
  );
  expect(isUndefinedTableError(err)).toBe(true);
});

test("a transient DB error (connection reset, no code) is NOT treated as undefined-table", () => {
  expect(
    isUndefinedTableError(new Error("Connection terminated unexpectedly")),
  ).toBe(false);
});

test("a different SQLSTATE (e.g. query_canceled, 57014) is NOT treated as undefined-table", () => {
  const err = Object.assign(
    new Error("canceling statement due to statement timeout"),
    {
      code: "57014",
    },
  );
  expect(isUndefinedTableError(err)).toBe(false);
});

test("non-object thrown values (string/undefined) are NOT treated as undefined-table", () => {
  expect(isUndefinedTableError("boom")).toBe(false);
  expect(isUndefinedTableError(undefined)).toBe(false);
});
