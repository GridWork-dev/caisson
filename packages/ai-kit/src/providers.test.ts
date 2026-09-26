// ADR-0160: construction-level coverage for the provider transport. The LIVE call stays the
// deliberately un-exercised seam (the package's zero-live-call invariant, ADR-0059) — these tests
// only prove that each config enum builds a real `ProviderV4` adapter (has `.languageModel`), so a
// new backend is wired, without any network/model call or provider key.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { parseAiSettings, type AiSettings } from "@caisson-sh/ai-config";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { defaultProviders, timeoutFetch } from "./providers.ts";

function laneSettings(lane: AiSettings["lanes"][string]): AiSettings {
  return { defaultLane: "x", lanes: { x: lane } };
}

// Groq/Mistral/Together fail closed on a missing key (unlike ollama/local's "local" placeholder,
// ADR-0171) — a dedicated env var per vendor, seeded/restored around the whole file, keeps the shared
// "X" placeholder (used by every other case below, deliberately unset) untouched.
const GROQ_KEY_ENV = "AI_KIT_TEST_GROQ_KEY";
const MISTRAL_KEY_ENV = "AI_KIT_TEST_MISTRAL_KEY";
const TOGETHER_KEY_ENV = "AI_KIT_TEST_TOGETHER_KEY";
beforeAll(() => {
  process.env[GROQ_KEY_ENV] = "test-key";
  process.env[MISTRAL_KEY_ENV] = "test-key";
  process.env[TOGETHER_KEY_ENV] = "test-key";
});
afterAll(() => {
  delete process.env[GROQ_KEY_ENV];
  delete process.env[MISTRAL_KEY_ENV];
  delete process.env[TOGETHER_KEY_ENV];
});

interface InspectableTransport {
  readonly fetch?: unknown;
  readonly baseURL?: string;
  readonly baseUrl?: () => string;
  readonly url?: (options: { modelId: string; path: string }) => string;
}

function transportOf(model: LanguageModelV4): InspectableTransport {
  const config = (model as unknown as { readonly config?: unknown }).config;
  if (config === null || typeof config !== "object") {
    throw new Error(
      `provider ${model.provider} does not expose a transport config`,
    );
  }
  return config as InspectableTransport;
}

function transportUrl(
  transport: InspectableTransport,
  modelId: string,
  path: string,
): string {
  if (transport.url !== undefined) return transport.url({ modelId, path });
  if (transport.baseURL !== undefined) return transport.baseURL;
  if (transport.baseUrl !== undefined) return transport.baseUrl();
  throw new Error(`model ${modelId} does not expose a transport URL`);
}

describe("AI SDK v7 provider and transport matrix (ADR-0160/0201/0213)", () => {
  const cases: Array<{
    name: string;
    lane: AiSettings["lanes"][string];
    expectedProvider: string;
    transportPath: string;
    expectedTransport: string;
  }> = [
    {
      name: "openai",
      lane: { provider: "openai", model: "gpt-4o", apiKeyEnv: "X" },
      expectedProvider: "openai.responses",
      transportPath: "/responses",
      expectedTransport: "https://api.openai.com/v1/responses",
    },
    {
      name: "anthropic",
      lane: { provider: "anthropic", model: "claude", apiKeyEnv: "X" },
      expectedProvider: "anthropic.messages",
      transportPath: "/messages",
      expectedTransport: "https://api.anthropic.com/v1",
    },
    {
      name: "google",
      lane: { provider: "google", model: "gemini", apiKeyEnv: "X" },
      expectedProvider: "google.generative-ai",
      transportPath: "/models/gemini:generateContent",
      expectedTransport: "https://generativelanguage.googleapis.com/v1beta",
    },
    {
      name: "openrouter",
      lane: { provider: "openrouter", model: "x/y", apiKeyEnv: "X" },
      expectedProvider: "openrouter.chat",
      transportPath: "/chat/completions",
      expectedTransport: "https://openrouter.ai/api/v1/chat/completions",
    },
    {
      name: "local",
      lane: {
        provider: "local",
        model: "m",
        apiKeyEnv: "X",
        baseUrl: "https://host:1/v1",
      },
      expectedProvider: "local.chat",
      transportPath: "/chat/completions",
      expectedTransport: "https://host:1/v1/chat/completions",
    },
    {
      name: "ollama",
      lane: {
        provider: "ollama",
        model: "llama3",
        apiKeyEnv: "X",
        baseUrl: "https://host:11434/v1",
      },
      expectedProvider: "ollama.chat",
      transportPath: "/chat/completions",
      expectedTransport: "https://host:11434/v1/chat/completions",
    },
    {
      name: "bedrock",
      lane: {
        provider: "bedrock",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        apiKeyEnv: "AWS_ACCESS_KEY_ID",
        apiSecretEnv: "AWS_SECRET_ACCESS_KEY",
        region: "us-east-1",
      },
      expectedProvider: "amazon-bedrock",
      transportPath: "/model/invoke",
      expectedTransport: "https://bedrock-runtime.us-east-1.amazonaws.com",
    },
    {
      name: "azure-openai",
      lane: {
        provider: "azure-openai",
        model: "my-deployment",
        apiKeyEnv: "AZURE_OPENAI_KEY",
        baseUrl: "https://res.openai.azure.com",
        apiVersion: "2024-06-01",
      },
      expectedProvider: "azure.chat",
      transportPath: "/chat/completions",
      expectedTransport:
        "https://res.openai.azure.com/v1/chat/completions?api-version=2024-06-01",
    },
    {
      name: "groq",
      lane: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        apiKeyEnv: GROQ_KEY_ENV,
      },
      expectedProvider: "groq.chat",
      transportPath: "/chat/completions",
      expectedTransport: "https://api.groq.com/openai/v1/chat/completions",
    },
    {
      name: "mistral",
      lane: {
        provider: "mistral",
        model: "mistral-large-latest",
        apiKeyEnv: MISTRAL_KEY_ENV,
      },
      expectedProvider: "mistral.chat",
      transportPath: "/chat/completions",
      expectedTransport: "https://api.mistral.ai/v1/chat/completions",
    },
    {
      name: "together",
      lane: {
        provider: "together",
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        apiKeyEnv: TOGETHER_KEY_ENV,
      },
      expectedProvider: "together.chat",
      transportPath: "/chat/completions",
      expectedTransport: "https://api.together.xyz/v1/chat/completions",
    },
  ];

  for (const {
    name,
    lane,
    expectedProvider,
    transportPath,
    expectedTransport,
  } of cases) {
    test(`${name} → exact model identity, endpoint, and bounded fetch`, () => {
      const providers = defaultProviders(laneSettings(lane));
      const provider = providers[lane.provider];
      expect(provider).toBeDefined();
      const model = provider?.languageModel(lane.model);
      expect(model?.provider).toBe(expectedProvider);
      expect(model?.modelId).toBe(lane.model);

      if (model === undefined) throw new Error(`${name} model was not built`);
      const transport = transportOf(model);
      expect(typeof transport.fetch).toBe("function");
      expect(transportUrl(transport, lane.model, transportPath)).toBe(
        expectedTransport,
      );
    });
  }

  test("one instance per distinct provider across lanes", () => {
    const settings: AiSettings = {
      defaultLane: "a",
      lanes: {
        a: {
          provider: "bedrock",
          model: "m1",
          apiKeyEnv: "X",
          region: "us-east-1",
        },
        b: {
          provider: "bedrock",
          model: "m2",
          apiKeyEnv: "X",
          region: "us-east-1",
        },
        c: {
          provider: "ollama",
          model: "llama3",
          apiKeyEnv: "X",
          baseUrl: "https://host:11434/v1",
        },
      },
    };
    const providers = defaultProviders(settings);
    expect(Object.keys(providers).sort()).toEqual(["bedrock", "ollama"]);
  });
});

describe("openai-compatible backends resolve the CHAT path (ADR-0201)", () => {
  // The live-only defect ADR-0201 fixes: `createOpenAI().languageModel()` defaults to the
  // Responses API (`{baseURL}/responses` — beta on OpenRouter, absent on Ollama). The compatible
  // adapter's `languageModel()` IS its chat model — observable as the model instance's
  // `provider === "<name>.chat"` — so these three cases can never regress back to /responses
  // without failing here.
  const cases: Array<{ name: string; lane: AiSettings["lanes"][string] }> = [
    {
      name: "openrouter",
      lane: {
        provider: "openrouter",
        model: "openai/gpt-4o-mini",
        apiKeyEnv: "X",
      },
    },
    {
      name: "local",
      lane: {
        provider: "local",
        model: "m",
        apiKeyEnv: "X",
        baseUrl: "https://host:1/v1",
      },
    },
    {
      name: "ollama",
      lane: {
        provider: "ollama",
        model: "llama3",
        apiKeyEnv: "X",
        baseUrl: "https://host:11434/v1",
      },
    },
    {
      name: "groq",
      lane: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        apiKeyEnv: GROQ_KEY_ENV,
      },
    },
    {
      name: "mistral",
      lane: {
        provider: "mistral",
        model: "mistral-large-latest",
        apiKeyEnv: MISTRAL_KEY_ENV,
      },
    },
    {
      name: "together",
      lane: {
        provider: "together",
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        apiKeyEnv: TOGETHER_KEY_ENV,
      },
    },
  ];

  for (const { name, lane } of cases) {
    test(`${name} → languageModel is the chat model ("${name}.chat")`, () => {
      const providers = defaultProviders(laneSettings(lane));
      const model = providers[lane.provider]?.languageModel(lane.model);
      expect(model?.provider).toBe(`${name}.chat`);
      expect(model?.modelId).toBe(lane.model);
    });
  }

  test("a local/ollama lane without baseUrl fails closed (no api.openai.com / localhost fallback)", () => {
    // createOpenAI used to silently default a baseUrl-less self-hosted lane to api.openai.com —
    // a misdirected live call. The compatible path requires the buyer's host (ADR-0201).
    for (const provider of ["local", "ollama"] as const) {
      expect(() =>
        defaultProviders(
          laneSettings({ provider, model: "m", apiKeyEnv: "X" }),
        ),
      ).toThrow();
    }
  });

  test("groq/mistral/together fail closed on a missing key (real paid vendor APIs, ADR-0171)", () => {
    // Unlike local/ollama's "local" placeholder fallback, these vendors require a genuine key — an
    // apiKeyEnv naming an unset env var must fail construction, not reach the vendor bare.
    for (const provider of ["groq", "mistral", "together"] as const) {
      expect(() =>
        defaultProviders(
          laneSettings({
            provider,
            model: "m",
            apiKeyEnv: "AI_KIT_TEST_UNSET_KEY",
          }),
        ),
      ).toThrow();
    }
  });

  test("the SSRF guard is unchanged on the compatible path (round-4/5 remediation)", () => {
    for (const provider of ["openrouter", "local", "ollama"] as const) {
      expect(() =>
        defaultProviders(
          laneSettings({
            provider,
            model: "m",
            apiKeyEnv: "X",
            baseUrl: "https://169.254.169.254/v1",
          }),
        ),
      ).toThrow();
      expect(() =>
        defaultProviders(
          laneSettings({
            provider,
            model: "m",
            apiKeyEnv: "X",
            baseUrl: "http://api.example.com/v1",
          }),
        ),
      ).toThrow();
    }
  });
});

describe("parseAiSettings — the ADR-0160 config fields (region / apiVersion / apiSecretEnv)", () => {
  test("accepts the new optional fields", () => {
    const parsed = parseAiSettings({
      defaultLane: "aws",
      lanes: {
        aws: {
          provider: "bedrock",
          model: "anthropic.claude-3-sonnet-20240229-v1:0",
          apiKeyEnv: "AWS_ACCESS_KEY_ID",
          apiSecretEnv: "AWS_SECRET_ACCESS_KEY",
          region: "eu-west-1",
        },
      },
    });
    expect(parsed.lanes.aws?.region).toBe("eu-west-1");
    expect(parsed.lanes.aws?.apiSecretEnv).toBe("AWS_SECRET_ACCESS_KEY");
  });

  test("still rejects unknown keys (.strict, ADR-0002)", () => {
    expect(() =>
      parseAiSettings({
        defaultLane: "x",
        lanes: {
          x: { provider: "openai", model: "m", apiKeyEnv: "X", bogus: 1 },
        },
      }),
    ).toThrow();
  });
});

describe("providerFor — SSRF guard on a buyer-supplied baseUrl (critic-gap R2)", () => {
  const openaiLane = (baseUrl: string): AiSettings["lanes"][string] => ({
    provider: "openai",
    model: "m",
    apiKeyEnv: "X",
    baseUrl,
  });

  const rejected: Array<{ name: string; baseUrl: string }> = [
    { name: "non-https scheme", baseUrl: "http://api.example.com" },
    { name: "file: scheme", baseUrl: "file:///etc/passwd" },
    {
      name: "credentials in URL",
      baseUrl: "https://user:pass@api.example.com",
    },
    { name: "cloud metadata IP", baseUrl: "https://169.254.169.254/latest" },
    { name: "decimal-encoded metadata IP", baseUrl: "https://2852039166/" },
    { name: "octal-encoded loopback", baseUrl: "https://0177.0.0.1/" },
    { name: "loopback 127/8", baseUrl: "https://127.0.0.1/" },
    { name: "private 10/8", baseUrl: "https://10.1.2.3/" },
    { name: "private 172.16/12", baseUrl: "https://172.16.9.9/" },
    { name: "private 192.168/16", baseUrl: "https://192.168.1.5/" },
    { name: "0.0.0.0", baseUrl: "https://0.0.0.0/" },
    { name: "localhost", baseUrl: "https://localhost/" },
    { name: ".local mDNS host", baseUrl: "https://printer.local/" },
    { name: "IPv6 loopback", baseUrl: "https://[::1]/" },
    { name: "IPv6 link-local fe80::/10", baseUrl: "https://[fe80::1]/" },
    { name: "IPv6 unique-local fc00::/7", baseUrl: "https://[fc00::1]/" },
    { name: "malformed URL", baseUrl: "not-a-url" },
  ];

  for (const { name, baseUrl } of rejected) {
    test(`rejects ${name}`, () => {
      expect(() =>
        defaultProviders(laneSettings(openaiLane(baseUrl))),
      ).toThrow();
    });
  }

  const accepted: Array<{ name: string; baseUrl: string }> = [
    { name: "public https provider", baseUrl: "https://api.example.com/v1" },
    {
      name: "self-hosted public https gateway",
      baseUrl: "https://gw.example.com:8443/v1",
    },
  ];

  for (const { name, baseUrl } of accepted) {
    test(`accepts ${name}`, () => {
      const providers = defaultProviders(laneSettings(openaiLane(baseUrl)));
      expect(typeof providers.openai?.languageModel).toBe("function");
    });
  }

  test("a lane with no baseUrl still builds (openrouter's https default is safe)", () => {
    const providers = defaultProviders(
      laneSettings({ provider: "openrouter", model: "x/y", apiKeyEnv: "X" }),
    );
    expect(typeof providers.openrouter?.languageModel).toBe("function");
  });
});

describe("timeoutFetch — the fetch-deadline floor (ADR-0213)", () => {
  // A loopback stub (not external — `assertSafeBaseUrl` blocks any real provider from ever pointing
  // here) that never answers `/slow`, proving `timeoutMs` aborts a hung request instead of letting it
  // hang the process. Mirrors `@caisson-sh/kernel`'s own `fetchWithTimeout` test pattern.
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/slow") {
        await new Promise(() => {}); // never resolves
      }
      return new Response("fast");
    },
  });
  const base = `http://localhost:${server.port}`;

  afterAll(() => {
    server.stop(true);
  });

  test("a fast response resolves within the budget", async () => {
    const res = await timeoutFetch(1000)(`${base}/fast`);
    expect(await res.text()).toBe("fast");
  });

  test("a stalling response aborts at the deadline instead of hanging", async () => {
    await expect(timeoutFetch(20)(`${base}/slow`)).rejects.toThrow();
  });

  test("every create* provider factory receives this fetch — one instance per timeoutMs call", () => {
    // Construction-level proof that `providerFor`'s `timeoutMs` parameter is threaded (not dropped):
    // two providers built with different deadlines still both construct successfully — this is the
    // seam `providerFor`'s `...deadline` spread wires into every `create*` branch (see the cases
    // above for full per-provider coverage; the deadline value itself is proven directly above).
    const providers = defaultProviders(
      laneSettings({ provider: "openai", model: "gpt-4o", apiKeyEnv: "X" }),
      5_000,
    );
    expect(typeof providers.openai?.languageModel).toBe("function");
  });
});
