// FIXTURE — exercised only by boundaries.test.ts (the eslint-CLI-driven import-boundary negative
// test, ADR-0011/0022). Stands in for a BASE package reaching a provider SDK directly, which the
// `no-restricted-imports` rule in boundaries.js must flag. This file lives outside every
// `PROVIDER_EXEMPT` glob (not under packages/ai-config or packages/ai-kit), so the
// boundary applies in full. Never imported by product code — lint-only.
import { createOpenAI } from "@ai-sdk/openai";

export const client = createOpenAI({ apiKey: "fixture-only" });
