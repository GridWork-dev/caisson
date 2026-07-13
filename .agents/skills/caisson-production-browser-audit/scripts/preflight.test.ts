import { describe, expect, test } from "bun:test";

import { probeAdminSession, runPreflight } from "./preflight";

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
      adminSessionLive: true,
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
        adminSessionLive: true,
        unresolvedMutations: 1,
      }),
    ).toThrow("cleanup");
  });

  test("reports missing credentials without inventing a fallback", () => {
    const result = runPreflight({
      env: {},
      buyerProfile: "caisson-probe",
      adminProfile: "caisson-admin-operator",
      adminSessionLive: true,
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
        adminSessionLive: true,
        unresolvedMutations: 0,
      }),
    ).toThrow("dedicated");
  });

  test("rejects an expired Ring-3 profile session", () => {
    expect(() =>
      runPreflight({
        env: credentials,
        buyerProfile: "caisson-probe",
        adminProfile: "caisson-admin-operator",
        adminSessionLive: false,
        unresolvedMutations: 0,
      }),
    ).toThrow("session");
  });
});

describe("Ring-3 profile session probe", () => {
  test("GETs get-session with the profile cookie jar and returns only liveness", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const live = await probeAdminSession((url, init) => {
      requestedUrl = url;
      requestedInit = init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            session: { id: "secret-session-id" },
            user: { email: "operator@example.invalid" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    });

    expect(live).toBe(true);
    expect(requestedUrl).toBe("https://admin.caisson.sh/api/auth/get-session");
    expect(requestedInit?.method).toBe("GET");
    expect(requestedInit?.credentials).toBe("include");
    expect(JSON.stringify(live)).not.toContain("secret-session-id");
    expect(JSON.stringify(live)).not.toContain("operator@example.invalid");
  });

  test("returns false for an expired empty session", async () => {
    await expect(
      probeAdminSession(() =>
        Promise.resolve(
          new Response("null", {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    ).resolves.toBe(false);
  });
});
