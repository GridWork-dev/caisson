"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, CodeBlock } from "@/components";
import {
  TURNSTILE_API_JS,
  useTurnstile,
} from "@/components/ask-ai/use-turnstile";

import styles from "./demo.module.css";
import type { DemoRunResult, DemoRunUnavailableReason } from "./types";
import {
  isUnavailableReason,
  isValidDemoProject,
  isValidEmail,
} from "./validation";

// The demo-run panel (F1 = (c)): POST the email + a project slug + a fail-closed Turnstile token to
// /api/demo/run, then browse the visitor's OWN generated file tree in place. The contract returns one
// JSON body (not a stream), so the "progress" is an honest client-side step ticker over the in-flight
// request — the real work is the server's single in-process generateDemo() call. Every failure state
// the contract can return (403 challenge · 429 rate-limit · 503 daily-cap / disabled) renders its own
// honest message and greys the CTA when the surface is genuinely unavailable (F5 kill switch).

type RunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: DemoRunResult }
  | { status: "challenge" } // 403 Turnstile fail-closed
  | { status: "rate-limited" } // 429
  | { status: "unavailable"; reason: DemoRunUnavailableReason } // 503
  | { status: "error" }; // network / malformed

// Step labels for the in-flight ticker (cosmetic — advances on a timer, not a real server stream).
// ponytail: fake progress ticker; swap for SSE only if the run ever grows past a sub-second response.
const STEPS = [
  "Resolving the module catalog…",
  "Generating your project files…",
  "Watermarking commercial stubs…",
  "Packaging the file tree…",
] as const;

export function DemoRunner() {
  const turnstile = useTurnstile();
  const [email, setEmail] = useState("");
  const [project, setProject] = useState("");
  const [state, setState] = useState<RunState>({ status: "idle" });
  const [step, setStep] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Proactive availability probe (F5): GET the run-path status once on mount so a tripped cap /
  // kill switch greys the CTA BEFORE a visitor fills the form, not only after a failed POST.
  // Fail-safe: any probe error leaves the form active — the POST path is the real gate.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/demo/run")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const s = (await res.json()) as { enabled?: unknown; reason?: unknown };
        if (!cancelled && s.enabled === false) {
          setState({
            status: "unavailable",
            reason: isUnavailableReason(s.reason) ? s.reason : "disabled",
          });
        }
      })
      .catch(() => {
        /* probe is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const running = state.status === "running";
  const capTripped =
    state.status === "unavailable" &&
    (state.reason === "daily-cap" || state.reason === "disabled");
  const canSubmit =
    !running &&
    !capTripped &&
    isValidEmail(email) &&
    isValidDemoProject(project);

  // Advance the cosmetic step ticker while the request is in flight.
  useEffect(() => {
    if (!running) return;
    setStep(0);
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      700,
    );
    return () => clearInterval(id);
  }, [running]);

  const run = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "running" });

    let token: string | undefined;
    try {
      token = await turnstile.getToken();
    } catch {
      token = undefined;
    }
    if (controller.signal.aborted) return;

    let res: Response;
    try {
      res = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          projectName: project.trim(),
          // Server is fail-closed on TURNSTILE_SECRET; an absent token (dev / unconfigured) is decided
          // server-side, mirroring the ask-ai panel.
          turnstileToken: token ?? "",
        }),
        signal: controller.signal,
      });
    } catch {
      if (!controller.signal.aborted) setState({ status: "error" });
      return;
    }

    if (res.status === 403) return setState({ status: "challenge" });
    if (res.status === 429) return setState({ status: "rate-limited" });
    if (res.status === 503) {
      let reason: DemoRunUnavailableReason = "disabled";
      try {
        const body: unknown = await res.json();
        const r = (body as { reason?: unknown } | null)?.reason;
        if (isUnavailableReason(r)) reason = r;
      } catch {
        /* keep the safe default */
      }
      return setState({ status: "unavailable", reason });
    }
    if (!res.ok) return setState({ status: "error" });

    try {
      const result = (await res.json()) as DemoRunResult;
      if (!controller.signal.aborted) setState({ status: "done", result });
    } catch {
      if (!controller.signal.aborted) setState({ status: "error" });
    }
  }, [email, project, turnstile]);

  return (
    <div className={styles.runner}>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) void run();
        }}
      >
        <div className={styles.field}>
          <label htmlFor="demo-email" className={styles.label}>
            Work email
          </label>
          <input
            id="demo-email"
            type="email"
            className={styles.input}
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            maxLength={254}
            disabled={running || capTripped}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="demo-project" className={styles.label}>
            Project name
          </label>
          <input
            id="demo-project"
            type="text"
            className={styles.input}
            placeholder="my-app"
            inputMode="text"
            value={project}
            maxLength={40}
            disabled={running || capTripped}
            onChange={(e) => setProject(e.target.value.toLowerCase())}
          />
        </div>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {running ? "Generating…" : "Generate a real app"}
        </Button>
      </form>

      <p className={styles.formNote}>
        The email is attribution only — never a password, never shared. You get
        a generated project you can read in full; the commercial modules arrive
        as watermarked stubs, not licensed source.
      </p>

      {/* Live region announces progress + terminal states to assistive tech. */}
      <div aria-live="polite" aria-busy={running}>
        {running && (
          <div className={styles.progress} role="status">
            <div className={styles.progressBar} aria-hidden="true">
              <span className={styles.progressFill} />
            </div>
            <p className={styles.progressLabel}>{STEPS[step]}</p>
          </div>
        )}

        {state.status === "challenge" && (
          <StateNote tone="warn">
            We couldn&apos;t verify your browser. Reload the page and try again.
          </StateNote>
        )}
        {state.status === "rate-limited" && (
          <StateNote tone="warn">
            You&apos;ve run a few demos in a short window. Give it a minute,
            then generate another.
          </StateNote>
        )}
        {state.status === "unavailable" && (
          <StateNote tone="warn">
            {state.reason === "daily-cap"
              ? "The sandbox has hit today's generation limit. It resets tomorrow — read the excerpts and the live preview below in the meantime."
              : "The sandbox is paused right now. The code excerpts and the live preview below are still here to explore."}
          </StateNote>
        )}
        {state.status === "error" && (
          <StateNote tone="warn">
            Something went wrong generating that. Try again in a moment.
          </StateNote>
        )}

        {state.status === "done" && (
          // key on runId → a second run remounts the viewer so `selected` can't point at a stale path.
          <RunResult key={state.result.runId} result={state.result} />
        )}
      </div>

      {/* Turnstile (F5 rider): invisible/managed, armed only when the public site key is set; the
          server verify is fail-closed on the secret. Same wiring as the ask-ai panel. */}
      {turnstile.enabled && (
        <>
          <Script
            src={TURNSTILE_API_JS}
            strategy="afterInteractive"
            onLoad={turnstile.onScriptLoad}
          />
          <div ref={turnstile.containerRef} aria-hidden="true" />
        </>
      )}
    </div>
  );
}

function StateNote({
  tone,
  children,
}: {
  tone: "warn";
  children: React.ReactNode;
}) {
  return (
    <p className={styles.stateNote} data-tone={tone} role="status">
      {children}
    </p>
  );
}

/** The visitor's own generated artifact: a selectable file list + an in-place viewer. */
function RunResult({ result }: { result: DemoRunResult }) {
  const paths = result.tree.map((t) => t.path);
  const [selected, setSelected] = useState<string>(paths[0] ?? "");
  const bytesByPath = new Map(result.tree.map((t) => [t.path, t.bytes]));
  const content = result.files[selected] ?? "";

  return (
    <div className={styles.result}>
      <div className={styles.resultHead}>
        <span className={styles.resultTitle}>
          Generated {result.tree.length} files in{" "}
          {(result.generatedInMs / 1000).toFixed(1)}s
        </span>
        <span className={styles.resultRunId}>
          run {result.runId.slice(0, 8)}
        </span>
      </div>

      {Array.isArray(result.moduleSummary?.modules) &&
        result.moduleSummary.modules.length > 0 && (
          <ul
            className={styles.moduleList}
            aria-label="Modules in this project"
          >
            {result.moduleSummary.modules.map((m) => (
              <li key={m.id} className={styles.moduleItem} data-tier={m.tier}>
                <code className="mono">{m.id}</code>
                <span className={styles.moduleTier}>
                  {m.tier === "paid" ? "stub" : "open"}
                </span>
              </li>
            ))}
          </ul>
        )}

      <div className={styles.browser}>
        <ul className={styles.fileList} aria-label="Generated files">
          {result.tree.map((t) => (
            <li key={t.path}>
              <button
                type="button"
                className={styles.fileRow}
                data-active={t.path === selected ? "" : undefined}
                onClick={() => setSelected(t.path)}
              >
                <span className={styles.filePath}>{t.path}</span>
                <span className={styles.fileBytes}>{t.bytes}B</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.viewer}>
          <CodeBlock
            frame
            label={selected || "file"}
            status={
              bytesByPath.has(selected)
                ? `${bytesByPath.get(selected)}B`
                : undefined
            }
            code={content}
          />
        </div>
      </div>
    </div>
  );
}
