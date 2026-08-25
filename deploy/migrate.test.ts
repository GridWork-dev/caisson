import { describe, expect, test } from "bun:test";

const subject = await import("./migrate.ts").catch(() => undefined);

describe("singleton Caisson migration image", () => {
  test("runs the site and admin schema entrypoints in fail-fast order", async () => {
    expect(subject?.runCaissonMigrations).toBeFunction();
    if (!subject) return;

    const calls: string[] = [];
    await subject.runCaissonMigrations({
      site: () => {
        calls.push("site");
        return Promise.resolve();
      },
      admin: () => {
        calls.push("admin");
        return Promise.resolve();
      },
    });
    expect(calls).toEqual(["site", "admin"]);

    calls.length = 0;
    await expect(
      subject.runCaissonMigrations({
        site: () => {
          calls.push("site");
          return Promise.reject(new Error("site migration failed"));
        },
        admin: () => {
          calls.push("admin");
          return Promise.resolve();
        },
      }),
    ).rejects.toThrow("site migration failed");
    expect(calls).toEqual(["site"]);
  });

  test("the published job image executes the combined entrypoint", async () => {
    const dockerfile = Bun.file(`${import.meta.dir}/Dockerfile.migrate`);
    expect(await dockerfile.exists()).toBe(true);
    expect(await dockerfile.text()).toContain(
      'CMD ["bun", "deploy/migrate.ts"]',
    );
  });
});
