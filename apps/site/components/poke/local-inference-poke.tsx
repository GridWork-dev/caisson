"use client";

// The local-inference module's poke (ADR-0378 lock 2, kimi CANDIDATES section B "On-device
// inference") — stay on the box: run the package's real deterministic StubInferenceBackend against
// a sample prompt, watch the egress meter hold at zero, then opt a rented backend in and watch it
// flip. The stub and model coordinates come from the package's deliberately narrow `./browser`
// entry; presentation helpers and fixtures stay local to this component. Nothing here fetches,
// persists, or measures the visitor — the "rented" path is a fully local simulation driven by the
// real local-privacy guard, never a provider transport or network call.
import { useEffect, useId, useMemo, useState } from "react";
import { isCaissonError } from "@caisson/kernel";
import {
  DEFAULT_ONNX_MODEL,
  EMBEDDING_DIM,
  StubInferenceBackend,
} from "@caisson/local-inference/browser";
import { createEgressGuard, localOnlyPolicy } from "@caisson/local-privacy";
import { Checkbox, Radio, StatusChip } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import type { VerdictState } from "./poke-rig";
import styles from "./local-inference-poke.module.css";

type BackendChoice = "on-device" | "rented";
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
      readonly outcome: "egressed";
      readonly host: string;
      readonly sinkKind: "rented-backend";
      readonly requests: 1;
      readonly usage: { readonly unit: "token"; readonly quantity: number };
    };

const SAMPLE_PROMPT =
  "Summarize the buyer's renewal risk from this support thread.";
const SAMPLE_RENTED_HOST = "api.rented-inference.example";
const SAMPLE_USAGE = { unit: "token", quantity: 128 } as const;
const STUB_BACKEND = new StubInferenceBackend();
const RENTED_ENDPOINT = `https://${SAMPLE_RENTED_HOST}/embed`;
const RENTED_GUARDS = {
  blocked: createEgressGuard(localOnlyPolicy([])),
  allowed: createEgressGuard(
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
  const [vector, setVector] = useState<Float32Array | null>(null);

  useEffect(() => {
    let live = true;
    void STUB_BACKEND.embed(prompt).then((v) => {
      if (live) setVector(v);
    });
    return () => {
      live = false;
    };
  }, [prompt]);

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
      label="@caisson/local-inference"
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
          onChange={(e) => setPrompt(e.target.value)}
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
          <p className={styles.srOnly} role="status" aria-live="polite">
            Sample embedding computed for the current prompt, {EMBEDDING_DIM}{" "}
            dimensions, rendered as {bars.length} bars.
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
          RentedInferenceBackend is off by default. Its constructor refuses to
          run unless this exact host is opted into the privacy allowlist for the
          rented-backend sink kind, fail-closed-to-offline.
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
            {reading.usage ? (
              <>
                <dt>metered</dt>
                <dd>
                  {reading.usage.quantity} {reading.usage.unit}
                  {reading.usage.quantity === 1 ? "" : "s"}
                </dd>
              </>
            ) : null}
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
function evaluateEgress(
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
    outcome: "egressed",
    host: SAMPLE_RENTED_HOST,
    sinkKind: "rented-backend",
    requests: 1,
    usage: SAMPLE_USAGE,
  };
}

function verdictMessage(reading: ReturnType<typeof evaluateEgress>): string {
  if (reading.outcome === "local") {
    return "0 requests left the device. embed() never calls out once the model is cached.";
  }
  if (reading.outcome === "blocked") {
    return `Blocked. ${reading.host} is not on the privacy allowlist yet, RentedInferenceBackend refuses to construct.`;
  }
  return `Crossed the boundary. 1 request to ${reading.host ?? "the endpoint"}, metered.`;
}
