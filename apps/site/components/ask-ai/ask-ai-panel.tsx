"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type AskState,
  type Citation,
  type ErrorKind,
  type EscalationReason,
  INITIAL,
  citationLabel,
  parseSse,
  reduceAsk,
} from "@/lib/ask-ai/client-stream";
import { Button } from "../button";
import styles from "./ask-ai.module.css";
import { TURNSTILE_API_JS, useTurnstile } from "./use-turnstile";

/** Where the panel is mounted — carried on the (text-free) Plausible events (ADR-0234 F6). */
export type AskSurface = "docs" | "palette";

// Plausible custom events — COUNTS ONLY, never question text (F6). `surface` distinguishes the two
// day-one placements (F3); it is not user content.
function track(event: string, surface: AskSurface): void {
  if (typeof window !== "undefined")
    window.plausible?.(event, { props: { surface } });
}

/** POST /api/ask + read the SSE stream into the state machine; fire the ask/answered/escalated events. */
function useAskAi(
  surface: AskSurface,
  getToken: () => Promise<string | undefined>,
) {
  const [state, setState] = useState<AskState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(
    async (raw: string): Promise<void> => {
      const question = raw.trim();
      if (question.length === 0 || question.length > 2000) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: "loading" });
      track("ask_ai_asked", surface);

      let token: string | undefined;
      try {
        token = await getToken();
      } catch {
        token = undefined;
      }
      if (controller.signal.aborted) return;

      let res: Response;
      try {
        res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            token !== undefined
              ? { question, turnstileToken: token }
              : { question },
          ),
          signal: controller.signal,
        });
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "error", kind: "network" });
          track("ask_ai_escalated", surface);
        }
        return;
      }
      if (!res.ok || res.body === null) {
        const kind =
          res.status === 403
            ? "challenge"
            : res.status === 400
              ? "request"
              : "network";
        setState({ status: "error", kind });
        track("ask_ai_escalated", surface);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let current: AskState = { status: "loading" };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSse(buffer);
          buffer = rest;
          for (const ev of events) {
            current = reduceAsk(current, ev);
            setState(current);
          }
        }
      } catch {
        if (controller.signal.aborted) return;
        current = { status: "error", kind: "network" };
        setState(current);
      }
      if (current.status === "cited") track("ask_ai_answered", surface);
      else if (current.status === "escalated" || current.status === "error") {
        track("ask_ai_escalated", surface);
      }
    },
    [surface, getToken],
  );

  const reset = useCallback((): void => {
    abortRef.current?.abort();
    setState(INITIAL);
  }, []);

  return { state, ask, reset };
}

export interface AskAiPanelProps {
  readonly surface: AskSurface;
  readonly autoFocus?: boolean;
}

/**
 * The shared Ask-AI panel: a question box that streams a grounded, cited answer over the docs corpus, and
 * renders every state honestly (loading, streaming, cited, and the insufficient / capped / service
 * fail-safes as an escalation CTA — ADR-0080). Used by BOTH day-one placements (F3): the docs-sidebar
 * widget and the ⌘K "Ask AI" tab.
 */
export function AskAiPanel({ surface, autoFocus = false }: AskAiPanelProps) {
  const turnstile = useTurnstile();
  const { state, ask, reset } = useAskAi(surface, turnstile.getToken);
  const [question, setQuestion] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const busy = state.status === "loading" || state.status === "streaming";
  const terminal =
    state.status === "cited" ||
    state.status === "escalated" ||
    state.status === "error";

  const submit = (): void => {
    if (!busy && question.trim().length > 0) void ask(question);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter submits; Shift+Enter inserts a newline (multi-line questions welcome).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.panel} data-surface={surface}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={`ask-ai-${surface}`} className={styles.srOnly}>
          Ask a question about the Caisson docs
        </label>
        <textarea
          id={`ask-ai-${surface}`}
          ref={inputRef}
          className={styles.input}
          placeholder="Ask about the docs — e.g. does the Compliance bundle do HIPAA?"
          value={question}
          maxLength={2000}
          rows={2}
          disabled={busy}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={busy || question.trim().length === 0}
        >
          {busy ? "Asking…" : "Ask AI"}
        </Button>
      </form>

      {/* aria-live announces streamed tokens + terminal states to assistive tech. */}
      <div className={styles.output} aria-live="polite" aria-busy={busy}>
        {state.status === "loading" && (
          <p className={styles.hint}>
            <span className={styles.spinner} aria-hidden="true" /> Searching the
            docs…
          </p>
        )}

        {(state.status === "streaming" || state.status === "cited") && (
          <Answer
            text={state.answer}
            streaming={state.status === "streaming"}
          />
        )}

        {state.status === "cited" && <Citations items={state.citations} />}

        {state.status === "escalated" && <Escalation reason={state.reason} />}

        {state.status === "error" && <ErrorState kind={state.kind} />}
      </div>

      {terminal && (
        <button
          type="button"
          className={styles.again}
          onClick={() => {
            reset();
            setQuestion("");
            inputRef.current?.focus();
          }}
        >
          Ask another question
        </button>
      )}

      <p className={styles.disclaimer}>
        Answers are generated from the Caisson docs and can be imperfect —
        verify anything load-bearing against the cited pages. Questions are
        stored to improve the product — don&apos;t include secrets or personal
        data.
      </p>

      {/* Turnstile (F5): invisible/managed, armed only when the public site key is set. The server verify
          is fail-closed. */}
      {turnstile.enabled && (
        <>
          <Script
            src={TURNSTILE_API_JS}
            strategy="afterInteractive"
            onLoad={turnstile.onScriptLoad}
          />
          <div
            ref={turnstile.containerRef}
            className={styles.turnstile}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}

function Answer({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <div className={styles.answer}>
      {/* Rendered as plain text (not MDX/HTML) — a model answer is untrusted output; never dangerouslySet. */}
      <p className={styles.answerText}>
        {text}
        {streaming && <span className={styles.caret} aria-hidden="true" />}
      </p>
    </div>
  );
}

function Citations({ items }: { items: readonly Citation[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.citations}>
      <span className={styles.citationsLabel}>Sources</span>
      <ul className={styles.chips}>
        {items.map((c) =>
          c.url !== null ? (
            <li key={c.source}>
              <Link href={c.url} className={styles.chip} title={c.source}>
                {citationLabel(c)}
              </Link>
            </li>
          ) : (
            <li key={c.source}>
              <span className={styles.chip} data-static="true" title={c.source}>
                {citationLabel(c)}
              </span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

const ESCALATION_COPY: Record<
  EscalationReason,
  { title: string; body: string }
> = {
  no_match: {
    title: "I couldn't find that in the docs",
    body: "This isn't covered in the Caisson docs yet. Browse the docs directly, or talk to the team.",
  },
  insufficient_context: {
    title: "I couldn't find that in the docs",
    body: "The docs don't have enough to answer that confidently. Browse the docs directly, or talk to the team.",
  },
  spend_cap: {
    title: "Ask AI is at today's limit",
    body: "We've hit today's usage cap on the free assistant. Talk to the team and we'll help right away.",
  },
  retrieval_unavailable: {
    title: "The assistant is briefly unavailable",
    body: "Couldn't reach the docs search just now. Try again in a moment, or talk to the team.",
  },
  generation_failed: {
    title: "Something went wrong",
    body: "The assistant couldn't answer that just now. Try again in a moment, or talk to the team.",
  },
  leaked_framing: {
    title: "Something went wrong",
    body: "The assistant couldn't produce a clean answer that time. Try again, or talk to the team.",
  },
};

function Escalation({ reason }: { reason: EscalationReason }) {
  const { title, body } = ESCALATION_COPY[reason];
  return (
    <div className={styles.escalation} role="status">
      <p className={styles.escalationTitle}>{title}</p>
      <p className={styles.escalationBody}>{body}</p>
      <div className={styles.ctaRow}>
        <Link href="/docs" className={styles.cta}>
          Browse the docs
        </Link>
        {/* G21: a real support surface, not the security/procurement page — the question text is
            already filed as a support ticket (best-effort), so this is a direct human channel, not
            a dead end. */}
        <Link
          href="mailto:admin@caisson.sh?subject=Ask%20AI%20question"
          className={styles.cta}
        >
          Talk to the team
        </Link>
      </div>
    </div>
  );
}

const ERROR_COPY: Record<ErrorKind, string> = {
  request: "That question couldn't be sent — try rephrasing or shortening it.",
  challenge: "We couldn't verify your browser. Reload the page and try again.",
  network: "Network hiccup reaching the assistant. Try again in a moment.",
};

function ErrorState({ kind }: { kind: ErrorKind }) {
  return (
    <div className={styles.escalation} role="alert">
      <p className={styles.escalationBody}>{ERROR_COPY[kind]}</p>
      <div className={styles.ctaRow}>
        <Link href="/docs" className={styles.cta}>
          Browse the docs
        </Link>
        {/* G21: a real support surface, not the security/procurement page — the question text is
            already filed as a support ticket (best-effort), so this is a direct human channel, not
            a dead end. */}
        <Link
          href="mailto:admin@caisson.sh?subject=Ask%20AI%20question"
          className={styles.cta}
        >
          Talk to the team
        </Link>
      </div>
    </div>
  );
}
