// Shared OpenRouter chat transport for the two intel model callers (production enrichment in
// llm.ts, the eval judge in eval/live-judge.ts). ONLY the request shape, response envelope
// schema, content extraction, and JSON recovery are shared — prompts, failure contracts
// (fail-soft enrichment vs fail-closed judge), and brief/verdict validation stay caller-local.
import { z } from "zod";
import { fetchJson } from "./http.ts";
import type { Fetcher } from "./http.ts";

export const OPENROUTER_ENDPOINT =
  "https://openrouter.ai/api/v1/chat/completions";
// OpenRouter completions routinely exceed the shared http.ts default (10s); this is the one
// outbound call class slow enough to need its own longer budget.
export const OPENROUTER_TIMEOUT_MS = 60_000;

const ChatMessage = z
  .object({
    role: z.string().optional(),
    content: z.string(),
    refusal: z.string().nullable().optional(),
    reasoning: z.string().nullable().optional(),
  })
  .strict();
const ChatChoice = z
  .object({
    index: z.number().int().optional(),
    finish_reason: z.string().nullable().optional(),
    native_finish_reason: z.string().nullable().optional(),
    logprobs: z.unknown().optional(),
    message: ChatMessage,
  })
  .strict();
const ChatResponse = z
  .object({
    id: z.string().optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    object: z.string().optional(),
    created: z.number().optional(),
    system_fingerprint: z.string().nullable().optional(),
    service_tier: z.string().nullable().optional(),
    usage: z.unknown().optional(),
    choices: z.array(ChatChoice).min(1),
  })
  .strict();

export interface OpenRouterChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

/**
 * POST one temperature-0 JSON-mode chat call and extract the first choice's content.
 * Returns null when the envelope fails the schema or the content is empty — the caller owns
 * what that means (fail-soft vs fail-closed) and the error message its lane reports.
 */
export async function openRouterChatContent(
  fetchImpl: Fetcher,
  apiKey: string,
  model: string,
  messages: readonly OpenRouterChatMessage[],
): Promise<string | null> {
  const raw = await fetchJson<unknown>(
    fetchImpl,
    OPENROUTER_ENDPOINT,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages,
        response_format: { type: "json_object" },
      }),
    },
    OPENROUTER_TIMEOUT_MS,
  );
  const parsedResponse = ChatResponse.safeParse(raw);
  const content = parsedResponse.success
    ? parsedResponse.data.choices[0]?.message.content
    : undefined;
  if (content === undefined || content.trim().length === 0) return null;
  return content;
}

/** Parse strict-JSON model output, recovering an embedded {...} object from prose wrapping.
 *  `who` keeps each lane's historical error string ("model"/"judge returned no JSON object"). */
export function parseJsonObject(content: string, who: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error(`${who} returned no JSON object`);
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
