"use client";

// The poke registry (ADR-0400) — the lazy client-only load map that used to live inside
// apps/site/components/media-carousel.tsx, moved here with the components it loads. Each entry is
// still `ssr: false`: a poke owns interactive state and drives its module's real browser
// primitives, so it renders in the browser or not at all, exactly as it did on the site.
//
// One poke per document here (the carousel's other slide kinds stayed behind), so `dynamic` is
// doing less work than it was — but keeping it means the runtime shape of a poke is unchanged by
// the move, which is what makes the moved components' own tests still the right proof.
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { PokeId } from "./ids";

const POKE_SLIDES: Record<PokeId, ComponentType> = {
  "access-review": dynamic(() => import("./access-review-poke"), {
    ssr: false,
  }),
  "agent-kernel": dynamic(() => import("./agent-kernel-poke"), { ssr: false }),
  "agent-runner": dynamic(() => import("./agent-runner-poke"), { ssr: false }),
  "agent-trajectory": dynamic(() => import("./agent-trajectory-poke"), {
    ssr: false,
  }),
  "ai-evals": dynamic(() => import("./ai-evals-poke"), { ssr: false }),
  "ai-meter": dynamic(() => import("./ai-meter-poke"), { ssr: false }),
  alerting: dynamic(() => import("./alerting-poke"), { ssr: false }),
  "audit-worm": dynamic(() => import("./audit-worm-poke"), { ssr: false }),
  "billing-orchestration": dynamic(
    () => import("./billing-orchestration-poke"),
    { ssr: false },
  ),
  "compliance-core": dynamic(() => import("./compliance-core-poke"), {
    ssr: false,
  }),
  credits: dynamic(() => import("./credits-poke"), { ssr: false }),
  "field-crypto": dynamic(() => import("./field-crypto-poke"), { ssr: false }),
  "frameworks-pack": dynamic(() => import("./frameworks-pack-poke"), {
    ssr: false,
  }),
  guardrails: dynamic(() => import("./guardrails-poke"), { ssr: false }),
  "local-inference": dynamic(() => import("./local-inference-poke"), {
    ssr: false,
  }),
  "local-privacy": dynamic(() => import("./local-privacy-poke"), {
    ssr: false,
  }),
  "local-store": dynamic(() => import("./local-store-poke"), { ssr: false }),
  "local-sync": dynamic(() => import("./local-sync-poke"), { ssr: false }),
  "org-controls": dynamic(() => import("./org-controls-poke"), { ssr: false }),
  "oscal-spine": dynamic(() => import("./oscal-spine-poke"), { ssr: false }),
  "prompt-registry": dynamic(() => import("./prompt-registry-poke"), {
    ssr: false,
  }),
  "retention-runner": dynamic(() => import("./retention-runner-poke"), {
    ssr: false,
  }),
  "risk-register": dynamic(() => import("./risk-register-poke"), {
    ssr: false,
  }),
  "signing-primitive": dynamic(() => import("./signing-primitive-poke"), {
    ssr: false,
  }),
  "tool-exec": dynamic(() => import("./tool-exec-poke"), { ssr: false }),
  "trust-page": dynamic(() => import("./trust-page-poke"), { ssr: false }),
};

export function Poke({ id }: { id: PokeId }) {
  const Slide = POKE_SLIDES[id];
  return <Slide />;
}
