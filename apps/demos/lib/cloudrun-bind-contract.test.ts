import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("demos Cloud Run bind contract", () => {
  test("pins a portable bind instead of Docker's container-id hostname", () => {
    const dockerfile = readFileSync(
      resolve(import.meta.dir, "../Dockerfile"),
      "utf8",
    );
    const entrypoint = readFileSync(
      resolve(import.meta.dir, "../entrypoint.sh"),
      "utf8",
    );

    expect(dockerfile).toContain("HOSTNAME=0.0.0.0");
    expect(dockerfile).not.toContain("HOSTNAME=::");
    expect(dockerfile).toContain(
      "COPY --from=build /app/apps/demos/entrypoint.sh ./apps/demos/entrypoint.sh",
    );
    expect(dockerfile).toContain('CMD ["sh", "apps/demos/entrypoint.sh"]');
    expect(entrypoint).toContain("RAILWAY_ENVIRONMENT_ID:-");
    expect(entrypoint).toContain("K_SERVICE:-");
    expect(entrypoint).toContain("HOSTNAME='::'");
    expect(entrypoint).toContain("exec bun apps/demos/server.js");
  });
});
