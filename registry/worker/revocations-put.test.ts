// The publisher shim's fail-closed contract (ADR-0225 R-4=B): unprovisioned ⇒ 404, wrong bearer ⇒
// 401, malformed/oversized body ⇒ 4xx with NOTHING written, success ⇒ 204 with the canonical
// (deduped, sorted) artifact at the fixed key — and the written artifact round-trips through the
// read side's parser (revocation-list.ts), so the two halves can never disagree on shape.
import { describe, expect, test } from "bun:test";
import {
  REVOCATION_PUT_PATH,
  type R2PutBucketLike,
  handleRevocationPut,
  isRevocationPutRequest,
} from "./revocations-put";
import { makeRevocationDenySet } from "./revocation-list";

const TOKEN = "test-shim-bearer-token";

function fakeBucket(): {
  puts: Array<{ key: string; value: string }>;
} & R2PutBucketLike {
  const puts: Array<{ key: string; value: string }> = [];
  return {
    puts,
    put: (key: string, value: string) => {
      puts.push({ key, value });
      return Promise.resolve(undefined);
    },
  };
}

function putRequest(body: string, token: string | null = TOKEN): Request {
  return new Request(`https://registry.caisson.sh${REVOCATION_PUT_PATH}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
    body,
  });
}

describe("isRevocationPutRequest", () => {
  test("matches only PUT on the exact path", () => {
    expect(isRevocationPutRequest("PUT", REVOCATION_PUT_PATH)).toBe(true);
    expect(isRevocationPutRequest("GET", REVOCATION_PUT_PATH)).toBe(false);
    expect(isRevocationPutRequest("PUT", "/revocations/other.json")).toBe(
      false,
    );
  });
});

describe("handleRevocationPut", () => {
  test("unprovisioned (no secret) is 404 and writes nothing", async () => {
    const bucket = fakeBucket();
    const res = await handleRevocationPut(putRequest("{}"), {
      REVOCATIONS: bucket,
    });
    expect(res.status).toBe(404);
    expect(bucket.puts).toEqual([]);
  });

  test("unprovisioned (no bucket) is 404 even with the right bearer", async () => {
    const res = await handleRevocationPut(putRequest("{}"), {
      REVOCATIONS_PUT_TOKEN: TOKEN,
    });
    expect(res.status).toBe(404);
  });

  test("a wrong bearer is 401 and writes nothing", async () => {
    const bucket = fakeBucket();
    const res = await handleRevocationPut(
      putRequest('{"revokedLicenseIds":[]}', "wrong-token"),
      { REVOCATIONS: bucket, REVOCATIONS_PUT_TOKEN: TOKEN },
    );
    expect(res.status).toBe(401);
    expect(bucket.puts).toEqual([]);
  });

  test("a missing bearer is 401", async () => {
    const res = await handleRevocationPut(
      putRequest('{"revokedLicenseIds":[]}', null),
      { REVOCATIONS: fakeBucket(), REVOCATIONS_PUT_TOKEN: TOKEN },
    );
    expect(res.status).toBe(401);
  });

  test("invalid JSON is 400, nothing written", async () => {
    const bucket = fakeBucket();
    const res = await handleRevocationPut(putRequest("not-json"), {
      REVOCATIONS: bucket,
      REVOCATIONS_PUT_TOKEN: TOKEN,
    });
    expect(res.status).toBe(400);
    expect(bucket.puts).toEqual([]);
  });

  test("an unknown field is 400 (strict shape)", async () => {
    const res = await handleRevocationPut(
      putRequest('{"revokedLicenseIds":[],"extra":true}'),
      { REVOCATIONS: fakeBucket(), REVOCATIONS_PUT_TOKEN: TOKEN },
    );
    expect(res.status).toBe(400);
  });

  test("an oversized body is 413", async () => {
    const big = JSON.stringify({
      revokedLicenseIds: [`x${"y".repeat(600_000)}`],
    });
    const res = await handleRevocationPut(putRequest(big), {
      REVOCATIONS: fakeBucket(),
      REVOCATIONS_PUT_TOKEN: TOKEN,
    });
    expect(res.status).toBe(413);
  });

  test("success is 204 and stores the canonical deduped, sorted artifact at the fixed key", async () => {
    const bucket = fakeBucket();
    const res = await handleRevocationPut(
      putRequest(
        '{"revokedLicenseIds":["9b2d5b4e-8f61-4f2e-9b0a-2f6d3c1e0a22","1a2b3c4d-5e6f-4a1b-8c2d-0e1f2a3b4c5d","9b2d5b4e-8f61-4f2e-9b0a-2f6d3c1e0a22"]}',
      ),
      { REVOCATIONS: bucket, REVOCATIONS_PUT_TOKEN: TOKEN },
    );
    expect(res.status).toBe(204);
    expect(bucket.puts).toEqual([
      {
        key: "revocations/deny-set.json",
        value:
          '{"revokedLicenseIds":["1a2b3c4d-5e6f-4a1b-8c2d-0e1f2a3b4c5d","9b2d5b4e-8f61-4f2e-9b0a-2f6d3c1e0a22"]}',
      },
    ]);
  });

  test("the written artifact round-trips through the read side (revocation-list)", async () => {
    const bucket = fakeBucket();
    await handleRevocationPut(
      putRequest(
        '{"revokedLicenseIds":["7f8e9d0c-1b2a-4c3d-8e9f-0a1b2c3d4e5f","2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f"]}',
      ),
      { REVOCATIONS: bucket, REVOCATIONS_PUT_TOKEN: TOKEN },
    );
    const stored = bucket.puts[0]?.value ?? "";
    const denySet = makeRevocationDenySet(
      () => Promise.resolve(JSON.parse(stored) as unknown),
      0,
    );
    await denySet.maybeRefresh();
    const set = denySet.get();
    expect(set.has("2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f")).toBe(true);
    expect(set.has("7f8e9d0c-1b2a-4c3d-8e9f-0a1b2c3d4e5f")).toBe(true);
    expect(set.has("00000000-0000-4000-8000-000000000000")).toBe(false);
  });
});
