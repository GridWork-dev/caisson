import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

describe("demos generated route types", () => {
  test("typecheck waits for the build that cleans and regenerates .next", () => {
    const root = resolve(import.meta.dir, "../../..");
    const graph = JSON.parse(
      execFileSync(
        resolve(root, "node_modules/.bin/turbo"),
        [
          "run",
          "build",
          "typecheck",
          "--filter=@caisson-sh/demos",
          "--dry=json",
        ],
        { cwd: root, encoding: "utf8", timeout: 30_000 },
      ),
    ) as { tasks: { taskId: string; dependencies: string[] }[] };

    const typecheck = graph.tasks.find(
      (task) => task.taskId === "@caisson-sh/demos#typecheck",
    );
    expect(typecheck).toBeDefined();
    expect(typecheck?.dependencies).toContain("@caisson-sh/demos#build");
  });
});
