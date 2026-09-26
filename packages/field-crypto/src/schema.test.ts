import { expect, test } from "bun:test";
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";
import { FIELD_CRYPTO_KEY_SCHEMA_SQL } from "./schema.ts";

test("field-key production schema is append-only and carries the hardened tenant policies", () => {
  for (const table of ["field_key_version", "field_wrapped_dek"]) {
    expect(FIELD_CRYPTO_KEY_SCHEMA_SQL).toContain(`CREATE TABLE ${table}`);
    for (const line of buildTenantPolicySql(table).split("\n")) {
      if (line.startsWith("GRANT ")) continue;
      expect(FIELD_CRYPTO_KEY_SCHEMA_SQL).toContain(line);
    }
    expect(FIELD_CRYPTO_KEY_SCHEMA_SQL).toContain(
      `GRANT SELECT, INSERT ON ${table} TO app;`,
    );
    expect(FIELD_CRYPTO_KEY_SCHEMA_SQL).toContain(
      `REVOKE UPDATE, DELETE ON ${table} FROM app;`,
    );
    expect(FIELD_CRYPTO_KEY_SCHEMA_SQL).toContain(
      `BEFORE UPDATE OR DELETE ON ${table}`,
    );
  }
});
