// `mock.module` replaces `@clerk/backend` in Bun's process-wide module registry — it must be
// registered BEFORE `./clerk.ts` is first imported, so every test imports it via a dynamic
// `await import(...)` inside the test body (never a static top-level import here), matching the
// convention `packages/cli/src/interactive.test.ts` already established for a third-party SDK mock.
import { describe, expect, mock, test } from "bun:test";
import { AuthnError, ConfigError } from "@caisson-sh/kernel";

type VerifyTokenFn = (token: string, options: unknown) => Promise<unknown>;

let verifyTokenImpl: VerifyTokenFn = async () => {
  throw new Error("verifyTokenImpl not configured for this test");
};

mock.module("@clerk/backend", () => ({
  verifyToken: (token: string, options: unknown) =>
    verifyTokenImpl(token, options),
}));

const PAYLOAD_PERSONAL = { sub: "user_1", sid: "sess_1" };
const PAYLOAD_ORG_ADMIN = {
  sub: "user_2",
  sid: "sess_2",
  o: { id: "org_1", rol: "admin" },
};
const PAYLOAD_ORG_MEMBER = {
  sub: "user_3",
  sid: "sess_3",
  o: { id: "org_2", rol: "member" },
};

describe("Clerk driver — config fail-closed", () => {
  test("createClerkSessionVerifier throws ConfigError when neither jwtKey nor secretKey is supplied", async () => {
    const { createClerkSessionVerifier } = await import("./clerk.ts");
    expect(() => createClerkSessionVerifier({})).toThrow(ConfigError);
  });

  test("createClerkSessionVerifier throws ConfigError on empty-string keys", async () => {
    const { createClerkSessionVerifier } = await import("./clerk.ts");
    expect(() => createClerkSessionVerifier({ jwtKey: "" })).toThrow(
      ConfigError,
    );
  });

  test("verifyClerkSessionClaims throws ConfigError at the free-function call site too", async () => {
    const { verifyClerkSessionClaims } = await import("./clerk.ts");
    await expect(verifyClerkSessionClaims("tok", {})).rejects.toThrow(
      ConfigError,
    );
  });
});

describe("verifyClerkSessionClaims", () => {
  test("maps a personal-account session (no active Organization) to userId/sessionId only", async () => {
    verifyTokenImpl = async () => PAYLOAD_PERSONAL;
    const { verifyClerkSessionClaims } = await import("./clerk.ts");
    const claims = await verifyClerkSessionClaims("tok", { jwtKey: "pem" });
    expect(claims).toEqual({ userId: "user_1", sessionId: "sess_1" });
  });

  test("maps an active-Organization session's o.id/o.rol claims", async () => {
    verifyTokenImpl = async () => PAYLOAD_ORG_ADMIN;
    const { verifyClerkSessionClaims } = await import("./clerk.ts");
    const claims = await verifyClerkSessionClaims("tok", { jwtKey: "pem" });
    expect(claims).toEqual({
      userId: "user_2",
      sessionId: "sess_2",
      organizationId: "org_1",
      organizationRole: "admin",
    });
  });

  test("throws AuthnError when verifyToken rejects (invalid/expired/bad-signature token)", async () => {
    verifyTokenImpl = async () => {
      throw new Error("invalid signature");
    };
    const { verifyClerkSessionClaims } = await import("./clerk.ts");
    await expect(
      verifyClerkSessionClaims("bad", { jwtKey: "pem" }),
    ).rejects.toThrow(AuthnError);
  });

  test("throws AuthnError when the resolved payload is missing sub or sid (malformed)", async () => {
    verifyTokenImpl = async () => ({ sub: "user_1" }); // no sid
    const { verifyClerkSessionClaims } = await import("./clerk.ts");
    await expect(
      verifyClerkSessionClaims("tok", { jwtKey: "pem" }),
    ).rejects.toThrow(AuthnError);
  });

  test("throws AuthnError when sub or sid is an empty string, not just absent", async () => {
    const { verifyClerkSessionClaims } = await import("./clerk.ts");

    verifyTokenImpl = async () => ({ sub: "", sid: "sess_1" });
    await expect(
      verifyClerkSessionClaims("tok", { jwtKey: "pem" }),
    ).rejects.toThrow(AuthnError);

    verifyTokenImpl = async () => ({ sub: "user_1", sid: "" });
    await expect(
      verifyClerkSessionClaims("tok", { jwtKey: "pem" }),
    ).rejects.toThrow(AuthnError);
  });

  test("an empty-string o.id is treated as no Organization claim, not a real (empty) accountId", async () => {
    verifyTokenImpl = async () => ({
      sub: "user_1",
      sid: "sess_1",
      o: { id: "", rol: "admin" },
    });
    const { verifyClerkSessionClaims } = await import("./clerk.ts");
    const claims = await verifyClerkSessionClaims("tok", { jwtKey: "pem" });
    expect(claims.organizationId).toBeUndefined();
  });

  test("never leaks which failure branch fired — both paths throw the same AuthnError message", async () => {
    const { verifyClerkSessionClaims } = await import("./clerk.ts");

    verifyTokenImpl = async () => {
      throw new Error("network down");
    };
    let transportMsg: string | undefined;
    try {
      await verifyClerkSessionClaims("tok", { jwtKey: "pem" });
    } catch (e) {
      transportMsg = (e as Error).message;
    }

    verifyTokenImpl = async () => ({ sub: "user_1" }); // malformed
    let malformedMsg: string | undefined;
    try {
      await verifyClerkSessionClaims("tok", { jwtKey: "pem" });
    } catch (e) {
      malformedMsg = (e as Error).message;
    }

    expect(transportMsg).toBe(malformedMsg);
  });

  test("passes jwtKey/secretKey/authorizedParties through to verifyToken, omitting unset keys", async () => {
    let captured: unknown;
    verifyTokenImpl = async (_token, options) => {
      captured = options;
      return PAYLOAD_PERSONAL;
    };
    const { verifyClerkSessionClaims } = await import("./clerk.ts");
    await verifyClerkSessionClaims("tok", {
      jwtKey: "pem-key",
      authorizedParties: ["https://caisson.sh"],
    });
    expect(captured).toEqual({
      jwtKey: "pem-key",
      authorizedParties: ["https://caisson.sh"],
    });
  });
});

describe("clerkClaimsToSessionContext (pure mapper)", () => {
  test("falls back to accountId == userId, role owner, when no Organization claim", async () => {
    const { clerkClaimsToSessionContext } = await import("./clerk.ts");
    expect(
      clerkClaimsToSessionContext({ userId: "u1", sessionId: "s1" }),
    ).toEqual({ userId: "u1", accountId: "u1", role: "owner" });
  });

  test("honors a custom personalAccountRole default", async () => {
    const { clerkClaimsToSessionContext } = await import("./clerk.ts");
    expect(
      clerkClaimsToSessionContext({ userId: "u1", sessionId: "s1" }, "seat"),
    ).toEqual({ userId: "u1", accountId: "u1", role: "seat" });
  });

  test("maps an active Organization's admin role to kernel owner", async () => {
    const { clerkClaimsToSessionContext } = await import("./clerk.ts");
    expect(
      clerkClaimsToSessionContext({
        userId: "u1",
        sessionId: "s1",
        organizationId: "org_1",
        organizationRole: "admin",
      }),
    ).toEqual({ userId: "u1", accountId: "org_1", role: "owner" });
  });

  test("maps any non-admin Organization role to kernel seat", async () => {
    const { clerkClaimsToSessionContext } = await import("./clerk.ts");
    expect(
      clerkClaimsToSessionContext({
        userId: "u1",
        sessionId: "s1",
        organizationId: "org_1",
        organizationRole: "member",
      }),
    ).toEqual({ userId: "u1", accountId: "org_1", role: "seat" });
  });

  test("an Organization id with no role fails CLOSED to seat, never personalAccountRole (privilege-escalation guard)", async () => {
    const { clerkClaimsToSessionContext } = await import("./clerk.ts");
    // personalAccountRole passed as "owner" (the default) to prove the org branch does NOT fall
    // back to it — a missing o.rol must never grant owner-level rights on a shared org account.
    expect(
      clerkClaimsToSessionContext(
        { userId: "u1", sessionId: "s1", organizationId: "org_1" },
        "owner",
      ),
    ).toEqual({ userId: "u1", accountId: "org_1", role: "seat" });
  });
});

describe("createClerkSessionVerifier — composed driver", () => {
  test("verifySession resolves a SessionContext for a personal-account token", async () => {
    verifyTokenImpl = async () => PAYLOAD_PERSONAL;
    const { createClerkSessionVerifier } = await import("./clerk.ts");
    const verifier = createClerkSessionVerifier({ jwtKey: "pem" });
    await expect(verifier.verifySession("tok")).resolves.toEqual({
      userId: "user_1",
      accountId: "user_1",
      role: "owner",
    });
  });

  test("verifySession resolves an org-active member session mapped to seat", async () => {
    verifyTokenImpl = async () => PAYLOAD_ORG_MEMBER;
    const { createClerkSessionVerifier } = await import("./clerk.ts");
    const verifier = createClerkSessionVerifier({ jwtKey: "pem" });
    await expect(verifier.verifySession("tok")).resolves.toEqual({
      userId: "user_3",
      accountId: "org_2",
      role: "seat",
    });
  });

  test("verifySession rejects with AuthnError on an invalid token", async () => {
    verifyTokenImpl = async () => {
      throw new Error("bad sig");
    };
    const { createClerkSessionVerifier } = await import("./clerk.ts");
    const verifier = createClerkSessionVerifier({ jwtKey: "pem" });
    await expect(verifier.verifySession("bad")).rejects.toThrow(AuthnError);
  });

  test("honors a custom personalAccountRole passed to the factory", async () => {
    verifyTokenImpl = async () => PAYLOAD_PERSONAL;
    const { createClerkSessionVerifier } = await import("./clerk.ts");
    const verifier = createClerkSessionVerifier({
      jwtKey: "pem",
      personalAccountRole: "seat",
    });
    await expect(verifier.verifySession("tok")).resolves.toEqual({
      userId: "user_1",
      accountId: "user_1",
      role: "seat",
    });
  });
});
