import {
  Boundary,
  Flow,
  HAIRLINE,
  Sheet,
  SNode,
  TitleBlock,
} from "./schematics";
import styles from "./schematics.module.css";
import { fit } from "./svg-fit";

// Bespoke module blueprint sheets for the money/attestation seam (ADR-0377 language, executing
// ADR-0378 lock 1): the four commercial primitives underneath billing, credits, and compliance
// attestation. Server components, no interactivity, built entirely from the shared primitive
// vocabulary in "./schematics" (Sheet/SNode/Flow/Boundary/ByteStrip/TitleBlock).
//
// Honest-artifact floor (ADR-0082/0237): every seam, port, table, and function name on these
// sheets is verbatim from the package it cites — packages/signing-primitive/src/sign.ts,
// packages/credits/src/credits.ts, packages/billing-orchestration/src/{drivers,idempotency}.ts,
// packages/alerting/src/{orchestrator,pipeline,channels,audit}.ts. Sample identifiers (g1..g4 in
// the credits FIFO chain) are schematic placeholders for real UUID rows, same convention as the
// shipped AuditWormSheet's e1..e4 chain entries.

// ===== signing-primitive blueprint sheet =====
// evidenceSignablePayload() = canonicalize(manifest) concatenated with chainAnchor.tipHash;
// Ed25519Signer.sign() produces the detached signature that lands in the EvidenceSignature
// interface (algorithm/keyId/publicKey/signature/timestamp?) -- a plain JSON record, never a
// packed byte buffer (sign.ts has no "envelope" concept). Only publicKey and signature carry a
// real fixed byte length (ED25519_PUBLIC_BYTES=32, ED25519_SIGNATURE_BYTES=64, checked in
// signEvidencePack()); verifyEvidenceSignature() fails CLOSED -- any unknown algorithm,
// malformed hex, or verification error returns false, never throws.
const SIGNING_EVIDENCE_FIELDS = [
  { x: 12, w: 60, label: "algorithm" },
  { x: 76, w: 44, label: "keyId" },
  { x: 124, w: 66, label: "publicKey" },
  { x: 194, w: 66, label: "signature" },
  { x: 264, w: 64, label: "timestamp?" },
] as const;

export function SigningPrimitiveSheet() {
  return (
    <Sheet
      title="signing-primitive: a per-tenant Ed25519 signer produces a detached signature over the canonicalized manifest plus its chain-anchor tip hash, held in a plain EvidenceSignature record, and verify fails closed on any error"
      bar="packages/signing-primitive · sign, EvidenceSignature, verify"
    >
      <SNode
        x={12}
        y={14}
        w={170}
        h={24}
        head="evidenceSignablePayload()"
        sub="canonicalize + tipHash"
      />
      <Flow x1={182} y1={26} x2={198} y2={26} />
      <SNode x={198} y={14} w={130} h={24} head="Ed25519Signer.sign()" />
      <text x={12} y={50} className={styles.note}>
        per-tenant key, never the license-issuer key
      </text>
      <Flow x1={263} y1={38} x2={263} y2={70} />
      {/* EvidenceSignature's real fields -- a plain JSON record, not a packed byte layout, so
          the cells sit apart rather than dimensioned edge-to-edge. Only publicKey and signature
          carry a code-verified byte length; the other three are unmeasured JSON fields. */}
      {SIGNING_EVIDENCE_FIELDS.map((f) => (
        <g key={f.label}>
          <rect
            x={f.x}
            y={70}
            width={f.w}
            height={20}
            rx={2}
            className={styles.cell}
            {...HAIRLINE}
          />
          <text
            x={f.x + f.w / 2}
            y={83}
            className={styles.cellLabel}
            {...fit(f.label, 9, f.w - 6)}
          >
            {f.label}
          </text>
        </g>
      ))}
      <text x={157} y={101} className={styles.dimLabel}>
        32 B
      </text>
      <text x={227} y={101} className={styles.dimLabel}>
        64 B
      </text>
      <Flow x1={170} y1={112} x2={170} y2={124} />
      {/* the ONE accent element: the fail-closed verify gate */}
      <Boundary
        x={40}
        y={124}
        w={260}
        h={44}
        label="verifyEvidenceSignature() · fails closed"
      />
      <SNode x={100} y={140} w={140} h={18} head="ed.verifyAsync()" />
      <text x={170} y={163} className={styles.subDanger}>
        any error ⇒ false
      </text>
      <TitleBlock x={190} y={172} w={138} text="SIGNING-PRIMITIVE · 1/1" />
    </Sheet>
  );
}

// ===== credits blueprint sheet =====
// grant() upserts credit_wallet.balance atomically (idempotent via idemColumns()'s exactly-one-of
// sourceEventId/idempotencyKey guard); debit() walks unexpiredGrantsFifo() in
// created_at/expires_at/id order and 402s (InsufficientCreditsError) fail-closed the moment the
// remainder can't be covered — nothing is recorded. spendableBalance() and clawback() are the two
// read/reversal seams that keep the ledger honest without ever going negative.
export function CreditsSheet() {
  return (
    <Sheet
      title="credits: grant() upserts the wallet atomically, debit() walks unexpired grants in FIFO order and 402s fail-closed the moment the remainder can't be covered"
      bar="packages/credits · grant, FIFO debit, fail-closed 402"
    >
      <SNode
        x={12}
        y={14}
        w={100}
        h={26}
        head="grant()"
        sub="GRANT_EVENT_TYPES"
      />
      <Flow x1={112} y1={27} x2={128} y2={27} />
      <SNode
        x={128}
        y={16}
        w={130}
        h={22}
        head="credit_wallet"
        sub="balance += amount"
      />
      <circle cx={300} cy={27} r={3} className={styles.port} {...HAIRLINE} />
      <text x={304} y={10} className={styles.portLabel} textAnchor="end">
        idemColumns()
      </text>
      <text x={12} y={54} className={styles.note}>
        balance = credit_wallet.balance + $2
      </text>
      <Flow x1={193} y1={38} x2={193} y2={64} />
      {/* the ONE accent element: the fail-closed debit gate */}
      <Boundary
        x={20}
        y={64}
        w={300}
        h={76}
        label="debit() · fail-closed 402"
      />
      <text x={28} y={90} className={styles.note}>
        unexpiredGrantsFifo()
      </text>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect
            x={28 + i * 44}
            y={100}
            width={36}
            height={18}
            rx={2}
            className={styles.cell}
            {...HAIRLINE}
          />
          <text x={46 + i * 44} y={112} className={styles.cellLabel}>
            {`g${i + 1}`}
          </text>
          {i < 3 ? (
            <text x={68 + i * 44} y={112} className={styles.sub}>
              →
            </text>
          ) : null}
        </g>
      ))}
      <text x={28} y={128} className={styles.noteDanger}>
        toCover &gt; 0 ⇒ InsufficientCreditsError
      </text>
      <text x={12} y={152} className={styles.note}>
        spendableBalance() = min(fifo, wallet)
      </text>
      <text x={12} y={164} className={styles.note}>
        clawback() never pushes wallet negative
      </text>
      <TitleBlock x={190} y={172} w={138} text="CREDITS · 1/1" />
    </Sheet>
  );
}

const BILLING_PROVIDERS = [
  { x: 12, w: 70, head: "Stripe" },
  { x: 88, w: 70, head: "Paddle" },
  { x: 164, w: 88, head: "LemonSqueezy" },
  { x: 258, w: 70, head: "Polar" },
] as const;

// ===== billing-orchestration blueprint sheet =====
// Four factory drivers (createStripeBilling/createPaddleBilling/createLemonSqueezyBilling/
// createPolarBilling) each satisfy the ONE @caisson-sh/billing BillingProvider port
// (verifyAndParse/createCheckout). verifyAndParse() feeds the webhook-idempotency guard:
// processEvent()/withIdempotentSideEffect() (the outer and per-side-effect layers,
// idempotency.ts) call the private claim() helper, which INSERTs INTO billing_processed_event
// ON CONFLICT (event_key) DO NOTHING -- the functions WRITE that table, not the reverse.
// createCheckout() is a wholly separate outbound flow (POSTs to start a NEW checkout
// session/transaction, drivers.ts/lemonsqueezy.ts/polar.ts) and never touches
// billing_processed_event, processEvent(), or withIdempotentSideEffect() (grep-confirmed).
export function BillingOrchestrationSheet() {
  return (
    <Sheet
      title="billing-orchestration: four provider drivers behind one BillingProvider port; verifyAndParse() feeds a claim-once idempotency guard that writes billing_processed_event, while createCheckout() is a separate outbound flow that never touches it"
      bar="packages/billing-orchestration · four drivers, one port, idempotent claim"
    >
      {BILLING_PROVIDERS.map((p) => (
        <g key={p.head}>
          <SNode x={p.x} y={14} w={p.w} h={22} head={p.head} />
          <Flow x1={p.x + p.w / 2} y1={36} x2={p.x + p.w / 2} y2={50} />
        </g>
      ))}
      {/* the ONE accent element: the shared provider port */}
      <Boundary
        x={12}
        y={50}
        w={316}
        h={38}
        label="BillingProvider · one port"
      />
      <SNode x={24} y={68} w={140} h={16} head="verifyAndParse()" />
      <SNode x={176} y={68} w={140} h={16} head="createCheckout()" />
      {/* verifyAndParse() feeds the idempotency guard below */}
      <Flow x1={94} y1={88} x2={94} y2={118} />
      {/* createCheckout(): a separate outbound POST -- a NEW session/transaction, never a
          claim -- diverges here and never rejoins the chain below */}
      <Flow x1={246} y1={88} x2={246} y2={96} />
      <text x={246} y={105} className={styles.note} textAnchor="middle">
        own outbound POST
      </text>
      <text x={246} y={114} className={styles.note} textAnchor="middle">
        new session, no claim
      </text>
      <SNode
        x={20}
        y={118}
        w={150}
        h={22}
        head="processEvent()"
        sub="outer claim · runs fn once"
      />
      <SNode
        x={182}
        y={118}
        w={146}
        h={22}
        head="withIdempotentSideEffect()"
        sub="per-effect claim"
      />
      {/* the functions call claim(), which writes the table -- not the other way round */}
      <Flow x1={170} y1={140} x2={170} y2={152} />
      <circle cx={170} cy={146} r={3} className={styles.port} {...HAIRLINE} />
      <text x={174} y={143} className={styles.portLabel}>
        claim()
      </text>
      <SNode
        x={61}
        y={152}
        w={218}
        h={16}
        head="billing_processed_event"
        sub="event_key PK · INSERT ... DO NOTHING"
      />
      <TitleBlock x={190} y={168} w={138} text="BILLING-ORCHESTRATION · 1/1" />
    </Sheet>
  );
}

const ALERT_CHANNELS = [
  { x: 20, w: 44, head: "email" },
  { x: 68, w: 58, head: "webhook" },
  { x: 130, w: 44, head: "slack" },
  { x: 178, w: 64, head: "telegram" },
  { x: 246, w: 58, head: "discord" },
] as const;

const ALERT_OUTCOMES = [
  { x: 12, w: 66, label: "delivered" },
  { x: 84, w: 73, label: "suppressed" },
  { x: 163, w: 60, label: "digested" },
  { x: 229, w: 34, label: "held" },
] as const;

// ===== alerting blueprint sheet =====
// processAlert() (src/orchestrator.ts) runs dedup() -> rateCap() -> quietHours() in order,
// short-circuiting to finish() the moment one of them doesn't say "deliver" — quietHours()
// itself always returns "deliver" for a critical event, no matter the hour. deliverAll()
// (src/channels.ts) fans out to five network drivers (email/webhook/slack/telegram/discord),
// each isolated behind attemptDeliver()'s catch so one channel's throw never aborts the rest.
// finish() always calls auditSink.record(), for every AlertOutcome.
export function AlertingSheet() {
  return (
    <Sheet
      title="alerting: dedup, rate-cap, and quiet-hours short-circuit before multi-channel delivery, each channel isolated behind its own catch, and every outcome writes exactly one audit row"
      bar="packages/alerting · pipeline, isolated delivery, audit row"
    >
      <SNode x={12} y={14} w={80} h={24} head="dedup()" sub="dedupeKey match" />
      <Flow x1={92} y1={26} x2={98} y2={26} />
      <SNode
        x={98}
        y={14}
        w={120}
        h={24}
        head="rateCap()"
        sub="maxPerWindow ⇒ digest"
      />
      <Flow x1={218} y1={26} x2={224} y2={26} />
      <SNode
        x={224}
        y={14}
        w={104}
        h={24}
        head="quietHours()"
        sub="critical bypasses"
      />
      <Flow x1={276} y1={38} x2={276} y2={48} />
      {/* the ONE accent element: the per-channel isolation gate */}
      <Boundary
        x={12}
        y={48}
        w={316}
        h={54}
        label="deliverAll() · per-channel isolation"
      />
      {ALERT_CHANNELS.map((c) => (
        <SNode key={c.head} x={c.x} y={64} w={c.w} h={16} head={c.head} />
      ))}
      <text x={20} y={90} className={styles.note}>
        channel throw ⇒ caught, others still deliver
      </text>
      <Flow x1={170} y1={102} x2={170} y2={114} />
      <SNode
        x={70}
        y={114}
        w={200}
        h={22}
        head="finish()"
        sub="always records the outcome"
      />
      <Flow x1={170} y1={136} x2={170} y2={146} />
      {ALERT_OUTCOMES.map((o) => (
        <g key={o.label}>
          <rect
            x={o.x}
            y={146}
            width={o.w}
            height={18}
            rx={2}
            className={styles.cell}
            {...HAIRLINE}
          />
          <text x={o.x + o.w / 2} y={158} className={styles.cellLabel}>
            {o.label}
          </text>
        </g>
      ))}
      <TitleBlock x={190} y={172} w={138} text="ALERTING · 1/1" />
    </Sheet>
  );
}
