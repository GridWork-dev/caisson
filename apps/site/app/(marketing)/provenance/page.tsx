import Link from "next/link";

import {
  Button,
  Card,
  CredentialStrip,
  Faq,
  FeatureGrid,
  Hero,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
  type IconName,
} from "@/components";
import { TrialPath } from "@/components/trial-path";
import { MediaCarousel } from "@/components/media-carousel";
import { mediaSlides } from "@/lib/media-manifest";
import { requireBundlePage } from "@/lib/bundle-pages";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { moduleMark } from "@/lib/marks";
import {
  bundlePriceById,
  formatPrice,
  formatUsd,
  modulesByBundle,
} from "@/lib/pricing";
import { TrackView } from "@/components/track-view";

// Hero copy, member list, and FAQ read from the shared bundle content record (lib/bundle-pages.ts);
// the bespoke controls + pricing sections below stay page-local.
const record = requireBundlePage("provenance");

export const metadata = buildMetadata({
  title: record.metaTitle,
  description: record.metaDescription,
  path: "/provenance",
});

const PAGE_URL = `${SITE_URL}/provenance`;

// Provenance is a first-class BUNDLE (ADR-0257), not an edition — its price comes from BUNDLE_PRICES,
// and its per-bundle Paddle checkout is wired in W7 (until then the CTAs route to the docs + the
// marketplace, never a fabricated "coming soon" — ADR-0237 rider 2 V1-live posture).
const bundle = bundlePriceById("provenance");
const priceLabel = bundle ? formatPrice(bundle) : "—";

// The bundle's real composed members (registry members map: signing-primitive · audit-worm ·
// field-crypto), rendered from the pricing catalog so labels + prices never drift.
const MEMBERS = modulesByBundle("provenance");

// Members that also have a depth page today (field-crypto, audit-worm) link out; signing-primitive
// has no depth page yet.
const MEMBER_DETAIL: ReadonlySet<string> = new Set([
  "field-crypto",
  "audit-worm",
]);

function MemberCard({
  id,
  label,
  oneLiner,
}: {
  id: string;
  label: string;
  oneLiner: string;
}) {
  const price = MEMBERS.find((m) => m.id === id);
  const card = (
    <Card interactive={MEMBER_DETAIL.has(id)}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cs-space-3)",
        }}
      >
        <Icon name={moduleMark(id)} size="lg" />
        <span className="cs-card-title">{label}</span>
      </div>
      <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
        {oneLiner}
      </p>
      {price && (
        <div style={{ marginTop: "var(--cs-space-4)" }}>
          <StatusChip label={formatUsd(price.amount)} tone="muted" />
        </div>
      )}
    </Card>
  );
  return MEMBER_DETAIL.has(id) ? (
    <Link
      href={`/marketplace/modules/${id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {card}
    </Link>
  ) : (
    card
  );
}

// Each primitive ships with a live, one-line artifact (the proof IS the claim — DESIGN.md §9).
const CONTROLS: readonly {
  icon: IconName;
  title: string;
  body: string;
  proof: string;
}[] = [
  {
    icon: "key",
    title: "Detached signing",
    body: "Sign an evidence bundle or an audit root with a detached Ed25519 signature and an RFC-3161 timestamp. The signature travels with the artifact; a verifier checks it with your public key alone — the private key never leaves your side of the boundary.",
    proof: "caisson evidence verify pack.json  →  sig ✓ · tsa ✓ · root 2c9f…b7",
  },
  {
    icon: "audit-chain",
    title: "Append-only audit chain",
    body: "Each audit row commits SHA-256 over the previous hash plus its own payload. Tampering with any historical row breaks every link after it — and the break is detectable, provable, and exportable for an auditor.",
    proof: "caisson audit verify  →  41984 rows · 0 breaks · root 2c9f…b7",
  },
  {
    icon: "worm",
    title: "WORM evidence storage",
    body: "Evidence buckets ship with S3 Object Lock in COMPLIANCE mode and a default retention. Inside the window an object cannot be overwritten or deleted — not by a bug, not by an operator, not by a leaked root key.",
    proof: "delete-object  →  AccessDenied: WORM-protected until 2033-06-27Z",
  },
  {
    icon: "field-crypto",
    title: "Per-tenant field encryption",
    body: "Sensitive columns are sealed with a data key derived per tenant from a root KMS key via HKDF-SHA256. A leaked tenant key exposes one tenant, never the table; rotating the root re-derives every key with no re-encrypt scan.",
    proof: "hkdf(rootKey, tenantId)  →  DEK·A cannot open DEK·B ciphertext",
  },
];

const FAQ = record.faq;

export default function ProvenancePage() {
  const heroArtifact = (
    <Terminal
      label="caisson evidence verify"
      status={<StatusChip label="verified" tone="success" dot />}
    >
      {`$ caisson evidence verify pack.json\n`}
      <span className="cs-tok-accent">{`✓ ed25519 signature  valid\n`}</span>
      <span className="cs-tok-accent">{`✓ rfc-3161 timestamp valid\n`}</span>
      <span className="cs-tok-accent">{`✓ audit chain        0 breaks\n`}</span>
      <span className="cs-tok-muted">{`  root 2c9f…b7 · 41984 rows\n`}</span>
      <span className="cs-tok-success">{`  provenance intact`}</span>
    </Terminal>
  );

  return (
    <>
      <TrackView item="bundle:provenance" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            softwareApplication({
              name: "Caisson Provenance",
              description: record.metaDescription,
              url: PAGE_URL,
              ...(bundle ? { price: bundle } : {}),
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumb([
              { name: "Home", path: "/" },
              { name: "Provenance", path: "/provenance" },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(faqPage([...FAQ])),
        }}
      />

      {/* ===== Hero ===== */}
      <Hero
        eyebrow={record.hero.eyebrow}
        title={record.hero.title}
        lede={record.hero.lede}
        ctas={
          <>
            <Button href="/marketplace?type=bundles" variant="primary">
              See the bundles
            </Button>
            <Button href="/docs" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={
          <CredentialStrip
            items={[
              "Ed25519 · RFC-3161",
              "SHA-256 audit chain",
              "WORM evidence",
              "Per-tenant field crypto",
            ]}
            note={`Own the source · ${priceLabel} one-time.`}
          />
        }
        artifact={heroArtifact}
      />

      {/* ===== What it composes ===== */}
      <Reveal>
        <Section
          eyebrow="What it composes"
          lede="The Provenance bundle is a real runtime composition of three @caisson/* packages, not marketing copy: signing-primitive (detached Ed25519 + RFC-3161 signing over evidence bundles and audit roots), audit-worm (the append-only SHA-256 audit chain plus the S3 Object-Lock WORM adapter), and field-crypto (per-tenant HKDF-SHA256 + AES-256-GCM field encryption). Every member is a workspace dependency re-exported through the bundle's own entry point — and every one is also a member of Compliance, so a Compliance owner already holds the whole set."
        />
      </Reveal>

      {/* ===== Media slot (ADR-0237 F2) ===== */}
      <Section>
        <MediaCarousel
          slides={mediaSlides("bundle", "provenance")}
          label="Provenance bundle media"
        />
      </Section>

      {/* ===== The three composed packages ===== */}
      <Reveal>
        <Section
          eyebrow="The composition"
          title="Three packages, one bundle."
          lede="Each member is a real workspace dependency — not a manifest claim. Each is also sold standalone, so you can take exactly the primitive you need."
        >
          <FeatureGrid cols={3}>
            {record.members.map((m) => (
              <MemberCard
                key={m.id}
                id={m.id}
                label={m.name}
                oneLiner={m.oneLiner}
              />
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== The four controls (evidence cards) ===== */}
      <Reveal>
        <Section
          eyebrow="What ships in the box"
          title="Four primitives, each with its proof."
          lede="No diagrams standing in for behaviour. The artifact carries the claim — a signature, a chain root, a denied delete, a refused cross-tenant decrypt."
        >
          <div className="cs-grid" style={{ marginTop: "var(--cs-space-8)" }}>
            {CONTROLS.map((c, i) => (
              <Reveal key={c.title} delay={i * 60}>
                <Card>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--cs-space-3)",
                    }}
                  >
                    <Icon name={c.icon} size="lg" />
                    <span className="cs-card-title">{c.title}</span>
                  </div>
                  <p
                    className="cs-muted"
                    style={{ marginTop: "var(--cs-space-3)" }}
                  >
                    {c.body}
                  </p>
                  <code
                    className="mono"
                    style={{
                      display: "block",
                      marginTop: "var(--cs-space-4)",
                      paddingTop: "var(--cs-space-4)",
                      borderTop: "1px solid var(--cs-border)",
                      fontSize: "var(--cs-text-xs)",
                      color: "var(--cs-fg-muted)",
                    }}
                  >
                    {c.proof}
                  </code>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
      </Reveal>

      {/* ===== Who it's for ===== */}
      <Reveal>
        <Section
          eyebrow="Who it's for"
          title="Teams that have to prove a record, not just store it."
          lede="Teams where the question isn't 'do you have the data' but 'can you prove it wasn't changed' — regulated records, legal holds, model-output audit trails, evidence you may have to defend years later. Provenance gives you a signature, a tamper-evident chain, and sealed-at-rest fields, so the proof travels with the artifact."
          band="tint"
        >
          <Card accent className="cs-elevate-md">
            <p
              style={{
                fontSize: "var(--cs-text-lg)",
                lineHeight: "var(--cs-leading-relaxed)",
                letterSpacing: "var(--cs-tracking-tight)",
                maxWidth: "60ch",
              }}
            >
              A record you can&rsquo;t prove is a record you can&rsquo;t defend.
              Provenance makes tamper-evidence a property of the storage layer,
              not a policy someone remembered to follow.
            </p>
          </Card>
        </Section>
      </Reveal>

      {/* ===== FAQ ===== */}
      <Reveal>
        <Section eyebrow="Questions" title="What an auditor asks first.">
          <Faq items={FAQ} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== Prove fit in week one (ADR-0272 §3) ===== */}
      <Reveal>
        <Section
          eyebrow="Trial path"
          title="Prove fit in week one."
          lede="Don't take the fit on faith — scaffold the audited base and run it on your own stack before you commit."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <TrialPath />
          </div>
        </Section>
      </Reveal>

      {/* ===== How it ships ===== */}
      <Reveal>
        <Section
          eyebrow="How Provenance is sold"
          title="Own the source, or take a single primitive."
          band="surface"
        >
          <Card accent className="cs-elevate-md">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                gap: "var(--cs-space-3)",
              }}
            >
              <span
                className="cs-num"
                style={{
                  fontSize: "var(--cs-text-3xl)",
                  fontWeight: "var(--cs-weight-semibold)",
                  letterSpacing: "var(--cs-tracking-tight)",
                }}
              >
                {priceLabel}
              </span>
              <span className="cs-tag">One-time license · own the source</span>
              <StatusChip label="Bundle" tone="muted" />
            </div>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "60ch" }}
            >
              A one-time, perpetual license over all three primitives, composed
              on the same audited base. Take a single primitive à la carte from
              the module catalog, or step up to Compliance, which composes
              Provenance plus fail-closed RLS, the evidence-pack generator, and
              the framework mappings.
            </p>
            <div className="cs-cta-row">
              <Button href="/marketplace?type=modules" variant="primary">
                Browse the modules
              </Button>
              <Button href="/compliance" variant="ghost">
                See Compliance
              </Button>
            </div>
          </Card>
        </Section>
      </Reveal>
    </>
  );
}
