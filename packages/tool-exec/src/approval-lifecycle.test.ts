import { expect, test } from "bun:test";
import { z } from "zod";
import { NotFoundError, ValidationError } from "@caisson-sh/kernel";
import {
  APPROVAL_TTL_MS,
  createMemoryApprovalStore,
  createToolExec,
  type StoredToolApproval,
  type ToolApprovalStore,
} from "./index.ts";

const spec = {
  name: "echo",
  command: "/bin/echo",
  argsSchema: z.array(z.string()),
};
function fixture(approvalStore?: ToolApprovalStore) {
  let at = 1_800_000_000_000;
  let spawns = 0;
  const now = () => at;
  const gate = createToolExec({
    allowlist: [spec],
    ...(approvalStore === undefined ? {} : { approvalStore }),
    now,
    execFn: async () => {
      spawns++;
      return { stdout: "", stderr: "", exitCode: 0 };
    },
  });
  return {
    gate,
    now,
    advance: (ms: number) => {
      at += ms;
    },
    spawns: () => spawns,
  };
}

test("1000 rejected approvals reclaim capacity without spawning or replay", async () => {
  const f = fixture();
  const pending = await Promise.all(
    Array.from({ length: 1000 }, () => f.gate.propose("echo", [])),
  );
  await expect(f.gate.propose("echo", [])).rejects.toThrow("excess pending");
  const rejected = await Promise.all(
    pending.map((p) => f.gate.reject(p.approvalId)),
  );
  expect(rejected.filter(Boolean)).toHaveLength(1000);
  expect(f.spawns()).toBe(0);
  expect(await f.gate.reject(pending[0]!.approvalId)).toBe(false);
  await expect(f.gate.execute(pending[0])).rejects.toThrow(NotFoundError);
  const fresh = await f.gate.propose("echo", ["fresh"]);
  expect((await f.gate.execute(fresh)).ok).toBe(true);
  expect(f.spawns()).toBe(1);
});

test("1000 expired approvals reclaim capacity on the next proposal", async () => {
  const f = fixture();
  const pending = await Promise.all(
    Array.from({ length: 1000 }, () => f.gate.propose("echo", [])),
  );
  f.advance(APPROVAL_TTL_MS);
  const fresh = await f.gate.propose("echo", ["fresh"]);
  await expect(f.gate.execute(pending[0])).rejects.toThrow(NotFoundError);
  expect((await f.gate.execute(fresh)).ok).toBe(true);
  expect(f.spawns()).toBe(1);
});

test("approval lifetime is fifteen minutes and expires at the exact boundary", async () => {
  const f = fixture();
  const valid = await f.gate.propose("echo", []);
  const expired = await f.gate.propose("echo", []);
  expect(APPROVAL_TTL_MS).toBe(900000);
  expect(valid.expiresAt).toBe(f.now() + 900000);
  f.advance(899999);
  expect((await f.gate.execute(valid)).ok).toBe(true);
  f.advance(1);
  await expect(f.gate.execute(expired)).rejects.toThrow(NotFoundError);
  expect(f.spawns()).toBe(1);
  expect(await f.gate.reject(expired.approvalId)).toBe(false);
});

test("memory consume deletes an expired record and never returns it", async () => {
  let at = 100;
  const store = createMemoryApprovalStore(() => at);
  const f = fixture(store);
  const pending = await f.gate.propose("echo", []);
  at = pending.expiresAt;
  expect(await store.consume(pending.approvalId)).toBeUndefined();
  expect(await store.reject(pending.approvalId)).toBe(false);
});

test("executor rejects an expired record returned by a durable adapter", async () => {
  let record: StoredToolApproval | undefined;
  const f = fixture({
    put: async (value) => {
      record = structuredClone(value);
    },
    consume: async () => {
      const found = record;
      record = undefined;
      return found;
    },
    reject: async () => {
      const found = record !== undefined;
      record = undefined;
      return found;
    },
  });
  const pending = await f.gate.propose("echo", []);
  f.advance(APPROVAL_TTL_MS);
  await expect(f.gate.execute(pending)).rejects.toThrow(NotFoundError);
  expect(f.spawns()).toBe(0);
});

test("client cannot extend the digest-bound expiration", async () => {
  const f = fixture();
  const pending = await f.gate.propose("echo", []);
  await expect(
    f.gate.execute({ ...pending, expiresAt: pending.expiresAt + 1 }),
  ).rejects.toThrow(ValidationError);
  expect(f.spawns()).toBe(0);
});

test("atomic reject wins against a later concurrent consume without executing", async () => {
  const f = fixture();
  const pending = await f.gate.propose("echo", []);
  const results = await Promise.allSettled([
    f.gate.reject(pending.approvalId),
    f.gate.execute(pending),
  ]);
  expect(results[0]).toEqual({ status: "fulfilled", value: true });
  expect(results[1]?.status).toBe("rejected");
  expect(f.spawns()).toBe(0);
});

test("a consume that already won cannot be retroactively revoked", async () => {
  const f = fixture();
  const pending = await f.gate.propose("echo", []);
  const results = await Promise.all([
    f.gate.execute(pending),
    f.gate.reject(pending.approvalId),
  ]);
  expect(results[0].ok).toBe(true);
  expect(results[1]).toBe(false);
  expect(f.spawns()).toBe(1);
});

test("reject validates IDs and unknown IDs return false without execution", async () => {
  const f = fixture();
  await expect(f.gate.reject("not-an-id")).rejects.toThrow(ValidationError);
  expect(await f.gate.reject(crypto.randomUUID())).toBe(false);
  expect(f.spawns()).toBe(0);
});
