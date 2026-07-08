// THE TEETH (Seam 1). The typed reads in `index.ts` SELECT a fixed column set out of
// `services/license`'s `entitlement_grant` / `license_grant` tables via raw SQL. Those tables live in
// `@caisson/service-license`; their DDL is the single source of truth for the columns that exist. This
// test parses the column identifiers out of that shared DDL and asserts every column each reader
// touches is present — so a column RENAME (or drop) in the service's schema fails HERE at test time,
// instead of silently desyncing the reader's SQL at runtime against a column that no longer exists.
//
// Dependency direction: platform-reads -> @caisson/service-license is DOWN (schema layer). The DDL
// constants are imported schema-only; no service runtime/business logic is pulled in. The gate's
// open<->commercial boundary permits it (both are commercial; service-license is a devDependency,
// used only by this test).
import { describe, expect, test } from "bun:test";
import {
  ENTITLEMENT_SCHEMA_SQL,
  LICENSE_GRANT_SCHEMA_SQL,
  ORDER_RECORD_SCHEMA_SQL,
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
} from "@caisson/service-license";
import {
  ENTITLEMENT_GRANT_READ_COLUMNS,
  LICENSE_GRANT_READ_COLUMNS,
  ORDER_RECORD_READ_COLUMNS,
  SUBSCRIPTION_STATUS_READ_COLUMNS,
} from "./index.ts";

/**
 * Extract the column identifiers declared in a `CREATE TABLE <name> ( ... )` block out of a DDL
 * string that may also contain `CREATE INDEX` / policy SQL after the table. Balanced-paren scan from
 * the table's opening paren, then take each top-level line whose first token is a bare lowercase
 * identifier (a column definition). Lines that open with `CONSTRAINT` / `CREATE` / a `(` (a wrapped
 * CHECK predicate) / an uppercased keyword are not columns and are skipped.
 */
function tableColumns(ddl: string, table: string): Set<string> {
  const start = ddl.indexOf(`CREATE TABLE ${table}`);
  if (start === -1) throw new Error(`CREATE TABLE ${table} not found in DDL`);
  const open = ddl.indexOf("(", start);
  if (open === -1) throw new Error(`no opening paren for table ${table}`);

  let depth = 0;
  let close = -1;
  for (let i = open; i < ddl.length; i++) {
    const ch = ddl[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) throw new Error(`unbalanced parens for table ${table}`);

  const body = ddl.slice(open + 1, close);
  const columns = new Set<string>();
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    // A column definition starts with a bare lowercase identifier (`account_id text ...`). Constraint
    // lines start with the uppercase `CONSTRAINT` keyword; wrapped predicate lines start with `(` or
    // `OR`; all are skipped by the lowercase-leading match.
    const m = /^([a-z_][a-z0-9_]*)\s+\S/.exec(line);
    if (m) columns.add(m[1]!);
  }
  return columns;
}

describe("columns contract: reads match the services/license DDL", () => {
  test("entitlement_grant exposes every column readEntitlementGrants touches", () => {
    const ddlColumns = tableColumns(
      ENTITLEMENT_SCHEMA_SQL,
      "entitlement_grant",
    );
    // Sanity: the parser found a non-trivial column set (guards against a silent parse miss that
    // would make every membership check vacuously pass).
    expect(ddlColumns.size).toBeGreaterThanOrEqual(
      ENTITLEMENT_GRANT_READ_COLUMNS.length,
    );
    for (const column of ENTITLEMENT_GRANT_READ_COLUMNS) {
      expect(
        ddlColumns.has(column),
        `entitlement_grant column "${column}" read by platform-reads is absent from ENTITLEMENT_SCHEMA_SQL — the schema renamed/dropped it; update the reader's column set`,
      ).toBe(true);
    }
  });

  test("license_grant exposes every column readLicenseGrantRows touches", () => {
    const ddlColumns = tableColumns(LICENSE_GRANT_SCHEMA_SQL, "license_grant");
    expect(ddlColumns.size).toBeGreaterThanOrEqual(
      LICENSE_GRANT_READ_COLUMNS.length,
    );
    for (const column of LICENSE_GRANT_READ_COLUMNS) {
      expect(
        ddlColumns.has(column),
        `license_grant column "${column}" read by platform-reads is absent from LICENSE_GRANT_SCHEMA_SQL — the schema renamed/dropped it; update the reader's column set`,
      ).toBe(true);
    }
  });

  test("subscription_status exposes every column readSubscriptionStatuses touches (ADR-0293)", () => {
    const ddlColumns = tableColumns(
      SUBSCRIPTION_STATUS_SCHEMA_SQL,
      "subscription_status",
    );
    expect(ddlColumns.size).toBeGreaterThanOrEqual(
      SUBSCRIPTION_STATUS_READ_COLUMNS.length,
    );
    for (const column of SUBSCRIPTION_STATUS_READ_COLUMNS) {
      expect(
        ddlColumns.has(column),
        `subscription_status column "${column}" read by platform-reads is absent from SUBSCRIPTION_STATUS_SCHEMA_SQL — the schema renamed/dropped it; update the reader's column set`,
      ).toBe(true);
    }
  });

  test("order_record exposes every column readOrderRecords touches (ADR-0293)", () => {
    const ddlColumns = tableColumns(ORDER_RECORD_SCHEMA_SQL, "order_record");
    expect(ddlColumns.size).toBeGreaterThanOrEqual(
      ORDER_RECORD_READ_COLUMNS.length,
    );
    for (const column of ORDER_RECORD_READ_COLUMNS) {
      expect(
        ddlColumns.has(column),
        `order_record column "${column}" read by platform-reads is absent from ORDER_RECORD_SCHEMA_SQL — the schema renamed/dropped it; update the reader's column set`,
      ).toBe(true);
    }
  });
});
