// ADR-0220 route plumbing: `mutationResponse` maps a dual-logged mutation result to its HTTP shape.
// The load-bearing case is a committed mutation whose post-commit WORM append failed — it must read
// as a DISTINCT do-not-retry success, never as a retryable 500 (a retry would double-apply).
import { describe, expect, test } from "bun:test";
import { mutationResponse } from "./admin-route.ts";

describe("mutationResponse (ADR-0220 dual-log HTTP shape)", () => {
  test("worm ok → plain 200 success with the result body", async () => {
    const res = mutationResponse({ worm: "ok", changed: 2 } as unknown as {
      worm: "ok" | "failed";
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.worm).toBe("ok");
    expect("message" in body).toBe(false); // no do-not-retry banner on the happy path
  });

  test("worm failed → 200 with a DISTINCT do-not-retry body (never a retryable failure)", async () => {
    const res = mutationResponse({ worm: "failed", changed: 1 } as unknown as {
      worm: "ok" | "failed";
    });
    // Still 200: the mutation succeeded and is recorded — the operator must NOT retry.
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.worm).toBe("failed");
    expect(body.ok).toBe(true);
    expect(String(body.message)).toContain("Do NOT retry");
  });
});
