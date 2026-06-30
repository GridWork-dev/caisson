// src/server.ts — the runnable license-issuer entrypoint (ADR-0110). Mirrors services/docs/src/server.ts:
// build deps ONCE at boot, serve the router over Bun.serve, and FAIL CLOSED before binding a socket.
// The issuer refuses to start without BOTH (1) the `LICENSE_ISSUE_TOKEN` Bearer (POST /issue is gated)
// and (2) the signing key (`Ed25519Signer.fromEnv` throws a ConfigError on a missing/malformed/
// non-Ed25519 `CAISSON_LICENSE_SIGNING_KEY`) — an unconfigured issuer must never serve an open or
// unsigned /issue.
//
// The tenant Transactor is INJECTED (the repo wires `db: Transactor` everywhere — apps/base, the billing
// webhook — and uses PGlite in tests; there is no in-repo production Postgres pool). The deploy entrypoint
// supplies a Neon-backed Transactor; the signing key → KMS swap (un-wired Signer seam) is the same
// operator-gated DEPLOY concern as the docs-service real-embedder seam.
import { resolve } from "node:path";
import { type BillingProvider, createPaddleBilling } from "@caisson/billing";
import { Ed25519Signer } from "@caisson/license-issue";
import { initObservability } from "@caisson/observability";
import { loadRegistryIndexFromFile } from "@caisson/registry-schema";
import type { Transactor } from "@caisson/tenancy-rls";
import { createApp } from "./app.ts";

const DEFAULT_PORT = 8789;

/** Resolve the built registry index baked into the repo (the same file the registry Worker serves). */
function defaultIndexPath(): string {
  return resolve(import.meta.dir, "../../../registry/index.json");
}

export interface StartServerOptions {
  /** Override the registry index path (defaults to the repo's built `registry/index.json`). */
  indexPath?: string;
}

/**
 * Start the issuer. Fails closed: a missing `LICENSE_ISSUE_TOKEN` OR a missing/invalid signing seed
 * aborts startup BEFORE the socket binds. The `db` Transactor is injected by the deploy entrypoint.
 */
export function startServer(
  db: Transactor,
  options: StartServerOptions = {},
): { port: number; stop: () => void } {
  // ADR-0117: wired first, before any other boot work — instrumentation must be live before the
  // modules it patches (node:http, pg) are first required. Env-gated: a no-op when
  // OTEL_EXPORTER_OTLP_ENDPOINT is unset (CI / local / no SigNoz configured).
  initObservability({ serviceName: "service-license" });

  const token = process.env.LICENSE_ISSUE_TOKEN ?? "";
  if (token.length === 0) {
    throw new Error(
      "LICENSE_ISSUE_TOKEN is required (POST /issue is fail-closed) — refusing to start.",
    );
  }
  // Throws ConfigError if CAISSON_LICENSE_SIGNING_KEY is missing/malformed/non-Ed25519 (never echoes it).
  const signer = Ed25519Signer.fromEnv();
  const index = loadRegistryIndexFromFile(
    options.indexPath ?? defaultIndexPath(),
  );

  // Paddle Merchant-of-Record webhook provider (ADR-0108/0116). It verifies the `Paddle-Signature` HMAC
  // over the raw body; the apiKey is only used by the (unexercised) checkout path, so a webhook-only
  // deploy may leave it blank. Without PADDLE_WEBHOOK_SECRET we cannot verify any signature, so the
  // provider is null and POST /webhook fails closed (401) — /issue + /health still serve.
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET ?? "";
  let provider: BillingProvider | null = null;
  if (webhookSecret.length > 0) {
    const paddleEnv =
      process.env.PADDLE_ENV === "sandbox" ? "sandbox" : "production";
    provider = createPaddleBilling({
      webhookSecret,
      apiKey: process.env.PADDLE_API_KEY ?? "",
      env: paddleEnv,
    });
  } else {
    process.stderr.write(
      "[service-license] PADDLE_WEBHOOK_SECRET unset — POST /webhook is fail-closed (401)\n",
    );
  }

  // `||` not `??`: a blank PORT="" must fall back to the default, not coerce to Number("")=0 (ephemeral).
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const handler = createApp({ token, signer, index, db, provider });
  const server = Bun.serve({ port, fetch: handler });
  process.stderr.write(
    `[service-license] issuer serving on :${String(server.port)}\n`,
  );
  return { port: server.port ?? port, stop: () => server.stop(true) };
}

if (import.meta.main) {
  // The deploy entrypoint must inject a Neon-backed Postgres Transactor (the repo has no in-tree
  // production pool — `db: Transactor` is injected everywhere, PGlite in tests). Wiring it is the
  // operator-gated DEPLOY act, not a build concern.
  throw new Error(
    "service-license issuer: wire a Postgres Transactor and call startServer(db) from the deploy entrypoint.",
  );
}
