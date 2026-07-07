import { describe, expect, test } from "bun:test";
import { createHealthzHandler } from "./healthz.ts";

describe("createHealthzHandler", () => {
  const handler = createHealthzHandler();

  test("GET /healthz returns 200 {ok:true}", async () => {
    const res = handler(new Request("http://localhost/healthz"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("any other path 404s", async () => {
    const res = handler(new Request("http://localhost/nope"));
    expect(res.status).toBe(404);
  });
});
