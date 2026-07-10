#!/usr/bin/env bun
/**
 * Emit true-to-code OpenAPI 3.0 specs from the services' real Zod request-body schemas, so
 * Schemathesis fuzzes the ACTUAL shapes the handlers parse (no hand-written spec to drift from the
 * code). The schemas are imported straight from each service's app.ts — the single source of truth
 * — and converted with zod-to-json-schema (`target: openApi3`, refs inlined).
 *
 *   bun run tools/security/emit-openapi.ts [--out tools/security/openapi]
 *
 * Output (git-ignored — always regenerated fresh by dast-schemathesis.sh, never a stale artifact):
 *   <out>/license.json   POST /issue /eval/apply /eval/issue  (Bearer) + GET /health
 *   <out>/docs.json      POST /query + GET /health
 *
 * /webhook is intentionally omitted: it verifies an HMAC signature before touching the body and is
 * deliberately non-strict (provider envelope), so schema-fuzzing it only yields 401s.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import {
  IssueBody,
  EvalApplyBody,
  EvalIssueBody,
} from "../../services/license/src/app.ts";
import { QuerySchema } from "../../services/docs/src/app.ts";

interface RouteSpec {
  path: string;
  /** POST routes carry a body schema; GET health carries none. */
  body?: ZodTypeAny;
  /** Bearer-gated (the issuer token). */
  auth?: boolean;
}

function jsonSchema(schema: ZodTypeAny): unknown {
  // openApi3 target = `nullable: true` (not type arrays) + no `$schema`; refs inlined so the schema
  // embeds directly in requestBody with no components/$defs plumbing.
  return zodToJsonSchema(schema, { target: "openApi3", $refStrategy: "none" });
}

function buildDoc(title: string, routes: readonly RouteSpec[]): unknown {
  const paths: Record<string, unknown> = {};
  for (const r of routes) {
    if (r.body === undefined) {
      paths[r.path] = {
        get: {
          operationId: `get_${r.path.replace(/\W+/g, "_")}`,
          responses: { "200": { description: "ok" } },
        },
      };
      continue;
    }
    paths[r.path] = {
      post: {
        operationId: `post_${r.path.replace(/\W+/g, "_")}`,
        ...(r.auth ? { security: [{ bearerAuth: [] }] } : {}),
        requestBody: {
          required: true,
          content: { "application/json": { schema: jsonSchema(r.body) } },
        },
        responses: {
          "200": { description: "ok" },
          "400": { description: "invalid request" },
          "401": { description: "unauthorized" },
          "402": { description: "payment required" },
        },
      },
    };
  }
  return {
    openapi: "3.0.3",
    info: { title, version: "0.0.0" },
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf("--out");
  const outDir = resolve(
    outIdx >= 0 && argv[outIdx + 1]
      ? String(argv[outIdx + 1])
      : join(import.meta.dir, "openapi"),
  );
  await mkdir(outDir, { recursive: true });

  const license = buildDoc("caisson-license", [
    { path: "/health" },
    { path: "/issue", body: IssueBody, auth: true },
    { path: "/eval/apply", body: EvalApplyBody, auth: true },
    { path: "/eval/issue", body: EvalIssueBody, auth: true },
  ]);
  const docs = buildDoc("caisson-docs", [
    { path: "/health" },
    { path: "/query", body: QuerySchema },
  ]);

  await writeFile(
    join(outDir, "license.json"),
    JSON.stringify(license, null, 2),
  );
  await writeFile(join(outDir, "docs.json"), JSON.stringify(docs, null, 2));
  process.stdout.write(
    `✓ emitted OpenAPI specs → ${outDir}/{license,docs}.json\n`,
  );
}

await main();
