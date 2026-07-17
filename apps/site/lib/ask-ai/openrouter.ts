// OpenRouter streaming inference (ADR-0234 F2 / ADR-0105). A thin client over the OpenAI-compatible
// POST /chat/completions with `stream: true`. Yields text deltas as they arrive, then the authoritative
// per-request USD cost from the final SSE chunk's `usage.cost` (OpenRouter includes full usage on every
// response automatically — the `stream_options`/`usage.include` params are now deprecated no-ops).
// OPENROUTER_API_KEY is server-only. An empty key / non-2xx / malformed stream throws GenerationError,
// and the caller escalates (mirrors rag.py's InferenceError path).
import { fetchWithTimeout } from "@caisson/kernel";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REFERER = "https://caisson.sh"; // OpenRouter attribution (HTTP-Referer / X-Title).
const TITLE = "Caisson Ask AI";

/** Generation failed — network, timeout, non-2xx, or a malformed/empty completion. Carries no secret. */
export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

/** One streamed event: an incremental text delta, or the terminal usage (USD cost from usage.cost,
 *  plus the prompt/completion token counts for $ai_generation observability — CAISSON-120). Tokens are
 *  optional: they ride the same terminal chunk as the cost, but a malformed/partial usage object may
 *  omit them, so a consumer defaults a missing count to 0. */
export type StreamEvent =
  | { readonly type: "delta"; readonly text: string }
  | {
      readonly type: "cost";
      readonly usd: number;
      readonly inputTokens?: number | undefined;
      readonly outputTokens?: number | undefined;
    };

export interface StreamArgs {
  readonly apiKey: string;
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  /** Connect timeout (time-to-first-byte) in ms. */
  readonly connectTimeoutMs?: number;
  /** Hard ceiling on the whole stream, in ms — a stuck stream is aborted rather than hanging. */
  readonly streamDeadlineMs?: number;
}

interface OpenRouterChunk {
  choices?: { delta?: { content?: string | null } }[];
  usage?: {
    cost?: number | null;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  } | null;
}

/** A finite non-negative token count, or undefined when the usage object omits/malforms it. */
function tokenCount(v: number | null | undefined): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/**
 * Stream a grounded completion. Async generator: `delta` events carry text as it generates; a single
 * `cost` event (when present) carries the request's USD cost for the spend ledger. The system turn holds
 * the fenced untrusted context; the user turn carries only the question (structural separation).
 */
export async function* streamOpenRouter(
  args: StreamArgs,
): AsyncGenerator<StreamEvent> {
  if (args.apiKey.length === 0) {
    throw new GenerationError("openrouter is not configured");
  }
  // A total-stream deadline so a stuck upstream can't hang the request forever (fetchWithTimeout only
  // bounds time-to-first-byte — it clears its timer once headers arrive). Merged into the fetch via
  // AbortSignal.any inside fetchWithTimeout.
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => {
    deadline.abort();
  }, args.streamDeadlineMs ?? 45_000);
  try {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: "POST",
          signal: deadline.signal,
          headers: {
            Authorization: `Bearer ${args.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": REFERER,
            "X-Title": TITLE,
          },
          body: JSON.stringify({
            model: args.model,
            messages: [
              { role: "system", content: args.system },
              { role: "user", content: args.user },
            ],
            temperature: args.temperature ?? 0.1,
            max_tokens: args.maxTokens ?? 800,
            stream: true,
          }),
        },
        { timeoutMs: args.connectTimeoutMs ?? 20_000 },
      );
    } catch {
      throw new GenerationError("openrouter request failed");
    }
    if (!res.ok || res.body === null) {
      throw new GenerationError(`openrouter returned ${String(res.status)}`);
    }

    // Parse the SSE stream: `data: {json}` lines, terminated by `data: [DONE]`. Buffer partial lines
    // across chunk boundaries.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf("\n");
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        let obj: OpenRouterChunk;
        try {
          obj = JSON.parse(data) as OpenRouterChunk;
        } catch {
          continue; // Skip a malformed keep-alive/comment line rather than fail the whole stream.
        }
        const delta = obj.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          yield { type: "delta", text: delta };
        }
        const cost = obj.usage?.cost;
        if (typeof cost === "number" && Number.isFinite(cost)) {
          yield {
            type: "cost",
            usd: cost,
            inputTokens: tokenCount(obj.usage?.prompt_tokens),
            outputTokens: tokenCount(obj.usage?.completion_tokens),
          };
        }
      }
    }
  } finally {
    clearTimeout(deadlineTimer);
  }
}
