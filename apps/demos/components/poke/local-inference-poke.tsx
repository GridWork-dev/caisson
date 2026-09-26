"use client";

// The local-inference module's poke (ADR-0378 lock 2, kimi CANDIDATES section B "On-device
// inference") — stay on the box: run the package's real deterministic StubInferenceBackend against
// a sample prompt, watch the egress meter hold at zero, then test whether policy would permit a
// rented backend. The stub and model coordinates come from the package's deliberately narrow `./browser`
// entry; presentation helpers and fixtures stay local to this component. Nothing here fetches,
// persists, or measures the visitor — the "rented" path is a fully local simulation driven by the
// real local-privacy guard, never a provider transport or network call.
import { useEffect, useId, useMemo, useState } from "react";
import { isCaissonError } from "@caisson-sh/kernel/browser";
import {
  DEFAULT_ONNX_MODEL,
  EMBEDDING_DIM,
  StubInferenceBackend,
} from "@caisson-sh/local-inference/browser";
import {
  createPrivacyDecisionGuard,
  localOnlyPolicy,
} from "@caisson-sh/local-privacy/browser";
import { Checkbox, Radio, StatusChip } from "@caisson-sh/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import type { VerdictState } from "./poke-rig";
import styles from "./local-inference-poke.module.css";

type BackendChoice = "on-device" | "rented";
type EmbeddingRun =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly vector: Float32Array }
  | { readonly status: "error" };
type EgressReading =
  | {
      readonly outcome: "local";
      readonly host: null;
      readonly sinkKind: null;
      readonly requests: 0;
      readonly usage: null;
    }
  | {
      readonly outcome: "blocked";
      readonly host: string;
      readonly sinkKind: "rented-backend";
      readonly requests: 0;
      readonly usage: null;
    }
  | {
      readonly outcome: "allowed";
      readonly host: string;
      readonly sinkKind: "rented-backend";
      readonly requests: 0;
      readonly usage: null;
    };

const SAMPLE_PROMPT =
  "Summarize the buyer's renewal risk from this support thread.";
const SAMPLE_RENTED_HOST = "api.rented-inference.example";
const STUB_BACKEND = new StubInferenceBackend();
const RENTED_ENDPOINT = `https://${SAMPLE_RENTED_HOST}/embed`;
const RENTED_GUARDS = {
  blocked: createPrivacyDecisionGuard(localOnlyPolicy([])),
  allowed: createPrivacyDecisionGuard(
    localOnlyPolicy([{ host: SAMPLE_RENTED_HOST, kind: "rented-backend" }]),
  ),
} as const;

const BACKENDS: readonly BackendChoice[] = ["on-device", "rented"];
const BACKEND_LABEL: Record<BackendChoice, string> = {
  "on-device": "On-device (OnnxEmbeddingBackend)",
  rented: "Rented (RentedInferenceBackend)",
};

export default function LocalInferencePoke() {
  const uid = useId();
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);
  const [backend, setBackend] = useState<BackendChoice>("on-device");
  const [hostAllowlisted, setHostAllowlisted] = useState(false);
  const [embedding, setEmbedding] = useState<EmbeddingRun>({
    status: "loading",
  });

  useEffect(() => {
    let live = true;
    setEmbedding({ status: "loading" });
    void computeSampleEmbedding(prompt).then(
      (vector) => {
        if (live) setEmbedding({ status: "success", vector });
      },
      () => {
        if (live) setEmbedding({ status: "error" });
      },
    );
    return () => {
      live = false;
    };
  }, [prompt]);

  const vector = embedding.status === "success" ? embedding.vector : null;
  const bars = useMemo(
    () => (vector ? normalizeBars(sparkBars(vector, 48)) : []),
    [vector],
  );

  const reading = useMemo(
    () => evaluateEgress(backend, hostAllowlisted),
    [backend, hostAllowlisted],
  );

  const verdictState: VerdictState =
    reading.outcome === "local"
      ? "ok"
      : reading.outcome === "blocked"
        ? "fail"
        : "neutral";

  return (
    <PokeShell
      label="@caisson-sh/local-inference"
      title="Run inference on-device. Watch the egress meter hold at zero."
    >
      <div className={styles.layout}>
        <div className={styles.modelCard}>
          <p className={styles.modelName}>OnnxEmbeddingBackend</p>
          <dl className={styles.register}>
            <dt>model</dt>
            <dd>
              {DEFAULT_ONNX_MODEL.modelId}@{DEFAULT_ONNX_MODEL.revision}
            </dd>
            <dt>modelHost</dt>
            <dd>{DEFAULT_ONNX_MODEL.modelHost}</dd>
            <dt>EMBEDDING_DIM</dt>
            <dd>{EMBEDDING_DIM}</dd>
          </dl>
        </div>

        <label className={styles.field} htmlFor={`${uid}-prompt`}>
          Prompt (sample text, edit it)
        </label>
        <textarea
          id={`${uid}-prompt`}
          className={styles.textarea}
          value={prompt}
          onInput={(e) => {
            setEmbedding({ status: "loading" });
            setPrompt(e.currentTarget.value);
          }}
          rows={2}
          spellCheck={false}
        />

        <div className={styles.sparkBlock}>
          <p className={styles.field}>
            Sample embedding, not live inference (dim {EMBEDDING_DIM})
          </p>
          <div className={styles.sparkStrip} aria-hidden="true">
            {bars.map((h, i) => (
              <span
                key={i}
                className={styles.sparkBar}
                style={{ blockSize: `${h}%` }}
              />
            ))}
          </div>
          <p
            className={
              embedding.status === "success" ? styles.srOnly : styles.note
            }
            role="status"
            aria-live="polite"
          >
            {embedding.status === "loading"
              ? "Computing sample embedding…"
              : embedding.status === "error"
                ? "Sample embedding unavailable. Edit the prompt to retry."
                : `Sample embedding computed for the current prompt, ${EMBEDDING_DIM} dimensions, rendered as ${bars.length} bars.`}
          </p>
          <p className={styles.note}>
            A fixed, deterministic placeholder vector, the real on-device model
            (a MiniLM-class ONNX model via transformers.js) never runs in this
            browser tab.
          </p>
        </div>

        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>Backend</legend>
          <div className={styles.optionRow}>
            {BACKENDS.map((b) => (
              <Radio
                key={b}
                name={`${uid}-backend`}
                label={BACKEND_LABEL[b]}
                checked={backend === b}
                onChange={() => setBackend(b)}
                className={styles.option}
              />
            ))}
          </div>
        </fieldset>

        <div className={styles.option}>
          <Checkbox
            label={`Allowlist ${SAMPLE_RENTED_HOST} as a rented-backend sink`}
            checked={hostAllowlisted}
            onChange={(e) => setHostAllowlisted(e.target.checked)}
            disabled={backend === "on-device"}
          />
        </div>
        <p className={styles.note}>
          This demo evaluates the same purpose-bound privacy policy without
          constructing RentedInferenceBackend or sending a provider request.
        </p>

        <div className={styles.outputPanel}>
          <Verdict state={verdictState}>{verdictMessage(reading)}</Verdict>
          <dl className={styles.register}>
            <dt>requests</dt>
            <dd>{reading.requests}</dd>
            <dt>host</dt>
            <dd>{reading.host ?? "none"}</dd>
            <dt>sinkKind</dt>
            <dd>{reading.sinkKind ?? "none"}</dd>
            <dt>metered</dt>
            <dd>none</dd>
          </dl>
        </div>

        <div className={styles.chipsRow}>
          <StatusChip label="model-fetch" tone="muted" />
          <StatusChip
            label="rented-backend"
            tone={reading.sinkKind === "rented-backend" ? "accent" : "muted"}
          />
        </div>
      </div>
    </PokeShell>
  );
}

/** Execute the same real package stub used by the component's async prompt effect. */
export function computeSampleEmbedding(prompt: string): Promise<Float32Array> {
  return STUB_BACKEND.embed(prompt);
}

/** Chunk-average a vector for the compact presentation strip; not package API. */
function sparkBars(vec: Float32Array, bars: number): number[] {
  if (vec.length === 0) return [];
  const chunk = Math.ceil(vec.length / bars);
  const output: number[] = [];
  for (let i = 0; i < vec.length; i += chunk) {
    const slice = vec.subarray(i, i + chunk);
    let sum = 0;
    for (const value of slice) sum += value;
    output.push(sum / slice.length);
  }
  return output;
}

/** Min-max normalize presentation bars to percentages; a flat strip stays visibly centered. */
function normalizeBars(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((value) => ((value - min) / (max - min)) * 100);
}

/** Drive the sample rented boundary through the real purpose-bound local-privacy guard. */
export function evaluateEgress(
  backend: BackendChoice,
  hostAllowlisted: boolean,
): EgressReading {
  if (backend === "on-device") {
    return {
      outcome: "local",
      host: null,
      sinkKind: null,
      requests: 0,
      usage: null,
    };
  }
  const guard = hostAllowlisted ? RENTED_GUARDS.allowed : RENTED_GUARDS.blocked;
  try {
    guard.assertAllowedFor(RENTED_ENDPOINT, "rented-backend");
  } catch (error) {
    if (!isCaissonError(error)) throw error;
    return {
      outcome: "blocked",
      host: SAMPLE_RENTED_HOST,
      sinkKind: "rented-backend",
      requests: 0,
      usage: null,
    };
  }
  return {
    outcome: "allowed",
    host: SAMPLE_RENTED_HOST,
    sinkKind: "rented-backend",
    requests: 0,
    usage: null,
  };
}

function verdictMessage(reading: ReturnType<typeof evaluateEgress>): string {
  if (reading.outcome === "local") {
    return "0 requests left the page. This demo ran only the deterministic browser stub.";
  }
  if (reading.outcome === "blocked") {
    return `Policy blocks ${reading.host}. The demo sent 0 requests and recorded no usage.`;
  }
  return `Policy would allow ${reading.host}, but this demo sent 0 requests and recorded no usage.`;
}
