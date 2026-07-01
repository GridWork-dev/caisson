import { describe, expect, test } from "bun:test";
import {
  createCascadeDbTarget,
  createObjectStorageTarget,
  createOrphanSweepTarget,
} from "./targets.ts";

describe("reference erasure targets", () => {
  test("createObjectStorageTarget delegates to the injected client", async () => {
    const calls: Array<{ subjectId: string; tenantId: string }> = [];
    const target = createObjectStorageTarget({
      client: {
        purge: async (subjectId, tenantId) => {
          calls.push({ subjectId, tenantId });
        },
      },
    });

    expect(target.name).toBe("object-storage-purge");
    await target.erase("sub_1", "ten_1");
    expect(calls).toEqual([{ subjectId: "sub_1", tenantId: "ten_1" }]);
  });

  test("createCascadeDbTarget delegates to the injected client", async () => {
    const calls: Array<{ subjectId: string; tenantId: string }> = [];
    const target = createCascadeDbTarget({
      client: {
        cascadeDelete: async (subjectId, tenantId) => {
          calls.push({ subjectId, tenantId });
        },
      },
    });

    expect(target.name).toBe("cascade-db-delete");
    await target.erase("sub_2", "ten_2");
    expect(calls).toEqual([{ subjectId: "sub_2", tenantId: "ten_2" }]);
  });

  test("createOrphanSweepTarget delegates to the injected client", async () => {
    const calls: Array<{ subjectId: string; tenantId: string }> = [];
    const target = createOrphanSweepTarget({
      client: {
        sweep: async (subjectId, tenantId) => {
          calls.push({ subjectId, tenantId });
        },
      },
    });

    expect(target.name).toBe("orphan-record-sweep");
    await target.erase("sub_3", "ten_3");
    expect(calls).toEqual([{ subjectId: "sub_3", tenantId: "ten_3" }]);
  });
});
