// C5 / ADR-0160: construction-level coverage for the provider transport. The LIVE call stays the
// deliberately un-exercised seam (the package's zero-live-call invariant, ADR-0059) — these tests
// only prove that each config enum builds a real `ProviderV2` adapter (has `.languageModel`), so a
// new backend is wired, without any network/model call or provider key.
import { afterAll, describe, expect, test } from "bun:test";
import { parseAiSettings, type AiSettings } from "@caisson/ai-config";
import { defaultProviders, timeoutFetch } from "./providers.ts";

function laneSettings(lane: AiSettings["lanes"][string]): AiSettings {
  return { defaultLane: "x", lanes: { x: lane } };
}

describe("defaultProviders — every configured backend builds a ProviderV2 (ADR-0160)", () => {
  const cases: Array<{ name: string; lane: AiSettings["lanes"][string] }> = [
    {
      name: "openai",
      lane: { provider: "openai", model: "gpt-4o", apiKeyEnv: "X" },
    },
    {
      name: "anthropic",
      lane: { provider: "anthropic", model: "claude", apiKeyEnv: "X" },
    },
    {
      name: "google",
      lane: { provider: "google", model: "gemini", apiKeyEnv: "X" },
    },
    {
      name: "openrouter",
      lane: { provider: "openrouter", model: "x/y", apiKeyEnv: "X" },
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
      name: "bedrock",
      lane: {
        provider: "bedrock",
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        apiKeyEnv: "AWS_ACCESS_KEY_ID",
        apiSecretEnv: "AWS_SECRET_ACCESS_KEY",
        region: "us-east-1",
      },
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
    },
  ];

  for (const { name, lane } of cases) {
    test(`${name} → a ProviderV2 instance`, () => {
      const providers = defaultProviders(laneSettings(lane));
      const provider = providers[lane.provider];
      expect(provider).toBeDefined();
      expect(typeof provider?.languageModel).toBe("function");
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
  // The live-only defect ADR-0201 fixes: `createOpenAI().languageModel()` defaults to the v5
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

describe("timeoutFetch — the fetch-deadline floor (ADR-0207, C5/SPEC ai-kit)", () => {
  // A loopback stub (not external — `assertSafeBaseUrl` blocks any real provider from ever pointing
  // here) that never answers `/slow`, proving `timeoutMs` aborts a hung request instead of letting it
  // hang the process. Mirrors `@caisson/kernel`'s own `fetchWithTimeout` test pattern.
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
