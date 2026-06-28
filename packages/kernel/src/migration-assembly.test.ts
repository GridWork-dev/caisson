import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson/testing";
import {
  type PackageMigrations,
  assembleMigrations,
} from "./migration-assembly.ts";

// A fixed 2-package input: `@caisson/billing` depends on `@caisson/kernel`, so the kernel's
// migrations must order first and `billing`'s 0001 renumbers to a global 0003.
const INPUT: readonly PackageMigrations[] = [
  {
    slug: "@caisson/billing",
    dependsOn: ["@caisson/kernel"],
    migrations: [
      {
        name: "0001_credit_ledger.sql",
        sql: "CREATE TABLE credit_event (\n  id uuid PRIMARY KEY,\n  account_id uuid NOT NULL REFERENCES accounts(id),\n  amount integer NOT NULL\n);\n",
      },
    ],
  },
  {
    slug: "@caisson/kernel",
    dependsOn: [],
    migrations: [
      {
        name: "0001_init.sql",
        sql: "CREATE TABLE schema_version (\n  version integer PRIMARY KEY,\n  checksum text NOT NULL,\n  applied_at timestamptz NOT NULL DEFAULT now()\n);\n",
      },
      {
        name: "0002_accounts.sql",
        sql: "CREATE TABLE accounts (\n  id uuid PRIMARY KEY,\n  created_at timestamptz NOT NULL DEFAULT now()\n);\n",
      },
    ],
  },
];

describe("migration-assembly (ADR-0070)", () => {
  test("merges two package sets into the golden renumbered sequence + ledger", () => {
    matchGolden(import.meta.url, "migration-merge", assembleMigrations(INPUT));
  });

  test("re-running is byte-identical (deterministic, ADR-0014)", () => {
    expect(JSON.stringify(assembleMigrations(INPUT))).toBe(
      JSON.stringify(assembleMigrations(INPUT)),
    );
  });

  test("orders by the dep DAG and renumbers globally", () => {
    const { sequence } = assembleMigrations(INPUT);
    expect(sequence.map((s) => s.sourcePackage)).toEqual([
      "@caisson/kernel",
      "@caisson/kernel",
      "@caisson/billing",
    ]);
    expect(sequence.map((s) => s.filename)).toEqual([
      "0001_init.sql",
      "0002_accounts.sql",
      "0003_credit_ledger.sql",
    ]);
  });

  test("the schema_version checksum is a single sha256 over the merged set", () => {
    const { schemaVersion } = assembleMigrations(INPUT);
    expect(schemaVersion).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a dependency cycle is rejected (flag, never guess)", () => {
    expect(() =>
      assembleMigrations([
        {
          slug: "@caisson/a",
          dependsOn: ["@caisson/b"],
          migrations: [{ name: "0001_a.sql", sql: "SELECT 1;" }],
        },
        {
          slug: "@caisson/b",
          dependsOn: ["@caisson/a"],
          migrations: [{ name: "0001_b.sql", sql: "SELECT 2;" }],
        },
      ]),
    ).toThrow(/cycle/);
  });

  test("a duplicate package slug is rejected", () => {
    expect(() =>
      assembleMigrations([
        { slug: "@caisson/a", dependsOn: [], migrations: [] },
        { slug: "@caisson/a", dependsOn: [], migrations: [] },
      ]),
    ).toThrow(/duplicate/);
  });

  test("a malformed migration filename is rejected", () => {
    expect(() =>
      assembleMigrations([
        {
          slug: "@caisson/a",
          dependsOn: [],
          migrations: [{ name: "init.sql", sql: "SELECT 1;" }],
        },
      ]),
    ).toThrow(/migration name/);
  });
});
