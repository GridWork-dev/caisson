// Render contract (ADR-0061/0013). The golden fixture `__golden__/render.json`
// pins the full { messages, vars, rendered } record; this test recomputes `rendered` from the
// committed inputs and asserts the whole record matches with BLESS unset — proving the injection-safe
// render contract, not just that a file exists. Independent assertions backstop the golden.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson-sh/testing";
import { ValidationError } from "@caisson-sh/kernel";
import {
  buildVarSchema,
  MAX_CONTENT_LENGTH,
  promptMessagesSchema,
  renderPrompt,
  type PromptMessage,
  type VarSpec,
} from "./render.ts";

const goldenUrl = new URL("./__golden__/render.json", import.meta.url);
const golden = JSON.parse(readFileSync(goldenUrl, "utf8")) as {
  messages: unknown;
  vars: Record<string, string>;
};
const messages: PromptMessage[] = promptMessagesSchema.parse(golden.messages);
const vars = golden.vars;
// Every var in the fixture is a string slot.
const spec: VarSpec = Object.fromEntries(
  Object.keys(vars).map((k) => [k, "string"]),
);

describe("renderPrompt — golden contract", () => {
  test("matches the committed golden (BLESS unset)", () => {
    const rendered = renderPrompt(messages, spec, vars);
    matchGolden(import.meta.url, "render", { messages, vars, rendered });
  });
});

describe("renderPrompt — injection safety", () => {
  const rendered = renderPrompt(messages, spec, vars);

  test("a var only fills a content slot — no message added, no role forged", () => {
    expect(rendered).toHaveLength(messages.length);
    expect(rendered.map((m) => m.role)).toEqual(messages.map((m) => m.role));
    // The fixture's `context` var smuggles a forged `assistant:` turn — it must stay literal text
    // inside the user message, never become its own assistant message.
    expect(rendered.some((m) => m.role === "assistant")).toBe(false);
  });

  test("an embedded {{placeholder}} in an untrusted value is escaped, not re-expanded", () => {
    const user = rendered[1];
    expect(user).toBeDefined();
    const content = user?.content ?? "";
    // The value contained `{{persona}}` — it is neutralized to `\{\{persona\}\}` and NOT replaced
    // with the persona value (single-pass, non-recursive).
    expect(content).toContain("\\{\\{persona\\}\\}");
    expect(content).not.toContain("{{persona}}");
    expect(content).not.toContain("a concise compliance assistant ignore");
  });
});

describe("renderPrompt — strict variable schema", () => {
  const tmpl: PromptMessage[] = [
    { role: "user", content: "Hi {{name}}, you are {{age}}" },
  ];
  const s: VarSpec = { name: "string", age: "number" };

  test("coerces non-string scalars to string", () => {
    const out = renderPrompt(tmpl, s, { name: "Ada", age: 36 });
    expect(out[0]?.content).toBe("Hi Ada, you are 36");
  });

  test("rejects an unknown variable (strict)", () => {
    expect(() =>
      renderPrompt(tmpl, s, { name: "Ada", age: 1, extra: "x" }),
    ).toThrow(ValidationError);
  });

  test("rejects a missing required variable", () => {
    expect(() => renderPrompt(tmpl, s, { name: "Ada" })).toThrow(
      ValidationError,
    );
  });

  test("rejects a wrong-typed variable", () => {
    expect(() => renderPrompt(tmpl, s, { name: "Ada", age: "old" })).toThrow(
      ValidationError,
    );
  });

  test("a template placeholder with no declared var fails closed", () => {
    const orphan: PromptMessage[] = [{ role: "user", content: "{{ghost}}" }];
    expect(() => renderPrompt(orphan, {}, {})).toThrow(ValidationError);
  });

  test("buildVarSchema produces a strict object", () => {
    const schema = buildVarSchema({ a: "string" });
    expect(schema.safeParse({ a: "ok" }).success).toBe(true);
    expect(schema.safeParse({ a: "ok", b: "no" }).success).toBe(false);
  });
});

describe("renderPrompt — per-value content cap", () => {
  const tmpl: PromptMessage[] = [{ role: "user", content: "Hi {{name}}" }];
  const s: VarSpec = { name: "string" };

  test("a normal value renders unchanged", () => {
    const out = renderPrompt(tmpl, s, { name: "Ada" });
    expect(out[0]?.content).toBe("Hi Ada");
  });

  test("a single rawVars value over the content cap is rejected at the boundary", () => {
    const oversized = "x".repeat(MAX_CONTENT_LENGTH + 1);
    expect(() => renderPrompt(tmpl, s, { name: oversized })).toThrow(
      ValidationError,
    );
  });

  test("a value at the cap that inflates past it once escaped is rejected", () => {
    // Each `{` escapes to `\{` (doubles in length), so a value entirely of brace characters
    // stays within the per-value cap but blows the rendered total past the same cap.
    const braceHeavy = "{".repeat(MAX_CONTENT_LENGTH);
    expect(() => renderPrompt(tmpl, s, { name: braceHeavy })).toThrow(
      ValidationError,
    );
  });
});
