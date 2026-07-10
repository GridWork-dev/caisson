import { describe, expect, test } from "bun:test";

import { runPreflight } from "./preflight";

const credentials = {
  CAISSON_E2E_ACCOUNT_EMAIL: "probe@example.invalid",
  CAISSON_E2E_ACCOUNT_PASSWORD: "super-secret-password",
  CAISSON_E2E_CF_CLIENT_ID: "secret-client-id",
  CAISSON_E2E_CF_CLIENT_SECRET: "secret-client-secret",
};

describe("browser audit preflight", () => {
  test("reports only credential presence", () => {
    const result = runPreflight({
      env: credentials,
      buyerProfile: "caisson-probe",
      adminProfile: "caisson-admin-operator",
      adminAuthorized: true,
      unresolvedMutations: 0,
    });
    const serialized = JSON.stringify(result);

    expect(result.credentials).toEqual({
      accountEmail: true,
      accountPassword: true,
      cfClientId: true,
      cfClientSecret: true,
    });
    for (const secret of Object.values(credentials)) {
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain(String(secret.length));
    }
  });

  test("fails closed on unresolved cleanup", () => {
    expect(() =>
      runPreflight({
        env: credentials,
        buyerProfile: "caisson-probe",
        adminProfile: "caisson-admin-operator",
        adminAuthorized: true,
        unresolvedMutations: 1,
      }),
    ).toThrow("cleanup");
  });

  test("reports missing credentials without inventing a fallback", () => {
    const result = runPreflight({
      env: {},
      buyerProfile: "caisson-probe",
      adminProfile: "caisson-admin-operator",
      adminAuthorized: true,
      unresolvedMutations: 0,
    });

    expect(result.ok).toBe(false);
    expect(Object.values(result.credentials)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  test("rejects shared or identical authenticated profiles", () => {
    expect(() =>
      runPreflight({
        env: credentials,
        buyerProfile: "default",
        adminProfile: "default",
        adminAuthorized: true,
        unresolvedMutations: 0,
      }),
    ).toThrow("dedicated");
  });
});
