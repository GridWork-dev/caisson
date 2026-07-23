import { Boundary, Flow, Sheet, SNode, TitleBlock } from "./schematics";
import styles from "./schematics.module.css";

// Compliance-cluster blueprint sheets (ADR-0377 vocabulary, executing ADR-0378 lock 1
// migrate-all): five module schematics for the compliance-gap SKUs, drawn against the same
// blueprint linework register the two pilot sheets in ./schematics established. Each sheet
// replaces a StageFlow mechanism diagram in marketplace-diagrams.tsx that targeted the same
// module page (rls-deny for compliance-core, frameworks-oscal, access-review-campaign,
// risk-register-residual, trust-page-redaction). The claim those diagrams made is carried
// forward here, in the drawing-register vocabulary.
//
// Honest-artifact floor (ADR-0082): every identifier below is read verbatim from the package it
// depicts (packages/compliance-core, frameworks-pack, access-review, risk-register, trust-page).
// One semantic accent boundary per sheet: the fail-closed gate the module is actually sold on.

// ===== module:compliance-core =====
// packages/compliance-core/src (evidence/collectors/rls-force.ts, evidence/collector.ts,
// evidence/generate.ts, evidence/binding-table.ts): a collector's pass/flagged/unresolved verdict
// feeds generateEvidencePack, which throws EvidencePackBlockedError (422) before any archive
// entry is written if a single control is unresolved: flag-never-guess, never a partial pack.
export function ComplianceCoreSheet() {
  return (
    <Sheet
      title="compliance-core: a collector's pass, flagged, or unresolved verdict feeds generateEvidencePack, which throws a 422 EvidencePackBlockedError before producing anything if a single control is unresolved"
      bar="packages/compliance-core · collectors, fail-closed gate, deterministic pack"
    >
      <SNode
        x={12}
        y={14}
        w={130}
        h={26}
        head="rlsForceCollector"
        sub="RLS FORCE + policy"
      />
      <Flow x1={142} y1={27} x2={156} y2={27} />
      <SNode
        x={156}
        y={14}
        w={132}
        h={26}
        head="collect(fact)"
        sub="pass · flagged · unresolved"
      />
      <Flow x1={222} y1={40} x2={222} y2={58} />
      {/* the ONE accent element: the flag-never-guess gate */}
      <Boundary
        x={40}
        y={58}
        w={260}
        h={56}
        label="generateEvidencePack · fail-closed"
      />
      <SNode
        x={54}
        y={76}
        w={118}
        h={26}
        head="unresolved ≥ 1"
        sub="hard block"
      />
      <Flow x1={172} y1={89} x2={186} y2={89} />
      <SNode
        x={186}
        y={76}
        w={100}
        h={26}
        head="422 thrown"
        sub="no partial pack"
      />
      <text x={12} y={128} className={styles.note}>
        archive: fixed 1980 mtimes, sorted, level 9
      </text>
      <text x={12} y={142} className={styles.note}>
        same evidence ⇒ same SHA-256, always
      </text>
      <text x={12} y={156} className={styles.note}>
        binding-table.ts: collectorId → controlId
      </text>
      <TitleBlock x={188} y={168} w={140} text="COMPLIANCE-CORE · 1/1" />
    </Sheet>
  );
}

// ===== module:frameworks-pack =====
// packages/frameworks-pack/src (registry/control.ts, crosswalks/regime-crosswalk.ts): every
// canonical control's crosswalk resolves through RegimeCrosswalkRow, a discriminated union on
// `claim`: "implements" type-requires a ProofPointer, "maps-to" carries none. Three own-authored
// packs; the OSCAL v1.2.2 catalog export (compliance-core, consuming this package's Framework[])
// addresses every control under a caisson URN.
export function FrameworksPackSheet() {
  return (
    <Sheet
      title="frameworks-pack: every crosswalk row is a discriminated union on claim, implements type-requires a proof pointer, maps-to carries none, over three own-authored framework packs"
      bar="packages/frameworks-pack · registry, claim posture, crosswalks"
    >
      <SNode
        x={12}
        y={14}
        w={118}
        h={26}
        head="defineFramework"
        sub="soc2-tsc · hipaa · eu-ai-act"
      />
      <Flow x1={130} y1={27} x2={144} y2={27} />
      <SNode
        x={144}
        y={14}
        w={150}
        h={26}
        head="CanonicalControl"
        sub="crosswalk: CrosswalkReference[]"
      />
      <Flow x1={219} y1={40} x2={219} y2={58} />
      {/* the ONE accent element: the claim-posture discriminated union */}
      <Boundary
        x={40}
        y={58}
        w={260}
        h={56}
        label="RegimeCrosswalkRow · claim union"
      />
      <SNode
        x={54}
        y={76}
        w={112}
        h={26}
        head='"implements"'
        sub="proof: ProofPointer"
      />
      <Flow x1={166} y1={89} x2={180} y2={89} />
      <SNode x={180} y={76} w={100} h={26} head='"maps-to"' sub="no proof" />
      <text x={12} y={128} className={styles.note}>
        packs: soc2-tsc · hipaa-security · eu-ai-act
      </text>
      <text x={12} y={142} className={styles.note}>
        (compliance-core) OSCAL: urn:caisson:control:&lt;id&gt;
      </text>
      <text x={12} y={156} className={styles.note}>
        SoA rows: applicable, unresolved, never guessed
      </text>
      <TitleBlock x={188} y={168} w={140} text="FRAMEWORKS-PACK · 1/1" />
    </Sheet>
  );
}

// ===== module:access-review =====
// packages/access-review/src (campaign.ts): openCampaign mints a roster row; recordDecision logs
// approve/revoke onto the tenant's WORM chain; closeCampaign refuses to close before every
// reviewee has decided or the deadline passes, and any reviewee still undecided lands in
// `unresolved` on the campaign.closed record, never auto-approved.
export function AccessReviewSheet() {
  return (
    <Sheet
      title="access-review: closeCampaign refuses to close before every reviewee has decided or the deadline passes, and any reviewee still undecided lands in unresolved on the campaign.closed record, never auto-approved"
      bar="packages/access-review · campaign kernel, WORM decision trail"
    >
      <SNode
        x={12}
        y={14}
        w={82}
        h={26}
        head="openCampaign"
        sub="roster snapshot"
      />
      <Flow x1={94} y1={27} x2={104} y2={27} />
      <SNode
        x={104}
        y={14}
        w={96}
        h={26}
        head="recordDecision"
        sub="approve · revoke"
      />
      <Flow x1={200} y1={27} x2={210} y2={27} />
      <SNode
        x={210}
        y={14}
        w={96}
        h={26}
        head="closeCampaign"
        sub="isComplete ∨ isDue"
      />
      <Flow x1={258} y1={40} x2={258} y2={58} />
      {/* the ONE accent element: the flag-never-guess close gate */}
      <Boundary x={40} y={58} w={260} h={56} label="close gate · fail-closed" />
      <SNode
        x={54}
        y={76}
        w={112}
        h={26}
        head="unresolved[]"
        sub="never auto-approved"
      />
      <Flow x1={166} y1={89} x2={180} y2={89} />
      <SNode
        x={180}
        y={76}
        w={100}
        h={26}
        head="campaign.closed"
        sub="completed | deadline"
      />
      <text x={12} y={128} className={styles.note}>
        kind: &quot;access-review.decision&quot;
      </text>
      <text x={12} y={142} className={styles.note}>
        onto the tenant&apos;s WORM audit chain
      </text>
      <text x={12} y={156} className={styles.note}>
        recordDecision refuses off-roster reviewees
      </text>
      <TitleBlock x={188} y={168} w={140} text="ACCESS-REVIEW · 1/1" />
    </Sheet>
  );
}

// ===== module:risk-register =====
// packages/risk-register/src (model.ts, override.ts, treatment-plan.ts): computeResidual is the
// only function that can mint a Residual (1-25, a branded type a bare number literal cannot
// satisfy); an operator override is its own chained "risk.residual-overridden" record on the WORM
// chain, never a silent edit, and a treatment-plan row's effective score reads the override when
// one governs, else the computed value.
export function RiskRegisterSheet() {
  return (
    <Sheet
      title="risk-register: computeResidual is the only function that can mint a Residual, a branded 1-25 type a bare number literal cannot satisfy; an operator override is its own chained risk.residual-overridden record, never a silent edit"
      bar="packages/risk-register · computed residual, chained override"
    >
      <SNode
        x={12}
        y={14}
        w={150}
        h={26}
        head="likelihood x impact"
        sub="5x5 ordinal, 1-5 each"
      />
      <Flow x1={162} y1={27} x2={176} y2={27} />
      <SNode
        x={176}
        y={14}
        w={140}
        h={26}
        head="computeResidual()"
        sub="branded Residual · 1-25"
      />
      <Flow x1={246} y1={40} x2={246} y2={58} />
      {/* the ONE accent element: the chained-exception boundary */}
      <Boundary
        x={40}
        y={58}
        w={260}
        h={56}
        label="recordResidualOverride · WORM chain"
      />
      <SNode
        x={54}
        y={76}
        w={232}
        h={26}
        head='"risk.residual-overridden"'
        sub="computed + override + who + why + at"
      />
      <text x={12} y={128} className={styles.note}>
        residual = computeResidual(likelihood, impact)
      </text>
      <text x={12} y={142} className={styles.note}>
        a bare number literal fails the type checker
      </text>
      <text x={12} y={156} className={styles.note}>
        effectiveResidual = override, else computed
      </text>
      <TitleBlock x={188} y={168} w={140} text="RISK-REGISTER · 1/1" />
    </Sheet>
  );
}

// ===== module:trust-page =====
// packages/trust-page/src (facts.ts, render.ts): flattenManifestFacts declares the full universe
// of dot-namespaced facts a page could ever show; generateTrustPage filters it down to
// DEFAULT_TRUST_PAGE_ALLOWLIST (aggregate posture only) before either output, HTML or JSON, is
// built. A field absent from the allowlist never renders, no exceptions.
export function TrustPageSheet() {
  return (
    <Sheet
      title="trust-page: flattenManifestFacts declares the full universe of dot-namespaced facts a page could show; generateTrustPage filters to the default allowlist before either output renders, and an absent field never renders, no exceptions"
      bar="packages/trust-page · allowlist redaction, html + json"
    >
      <SNode
        x={12}
        y={14}
        w={130}
        h={26}
        head="flattenManifestFacts"
        sub="dot-namespaced facts"
      />
      <Flow x1={142} y1={27} x2={156} y2={27} />
      <SNode
        x={156}
        y={14}
        w={130}
        h={26}
        head="generateTrustPage"
        sub="DEFAULT_TRUST_PAGE_ALLOWLIST"
      />
      <Flow x1={221} y1={40} x2={221} y2={58} />
      {/* the ONE accent element: the default-deny allowlist gate */}
      <Boundary
        x={40}
        y={58}
        w={260}
        h={56}
        label="allowlist gate · default-deny"
      />
      <SNode
        x={54}
        y={76}
        w={110}
        h={26}
        head="framework.title"
        sub="allowlisted → renders"
      />
      <SNode
        x={176}
        y={76}
        w={110}
        h={26}
        head="chainAnchor.tipHash"
        sub="absent → never renders"
      />
      <text x={12} y={128} className={styles.note}>
        generateTrustPage: html + json, self-contained
      </text>
      <text x={12} y={142} className={styles.note}>
        readiness gate bars compliant/certified
      </text>
      <text x={12} y={156} className={styles.note}>
        opt-in: CROSSWALK_ROLLUP_ROWS_KEY
      </text>
      <TitleBlock x={188} y={168} w={140} text="TRUST-PAGE · 1/1" />
    </Sheet>
  );
}
