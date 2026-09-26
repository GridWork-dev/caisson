import Link from "next/link";

import {
  Button,
  Card,
  Faq,
  Hero,
  Icon,
  Reveal,
  Section,
  type IconName,
} from "@/components";
import { LivingChainSection } from "@/components/living-chain-lazy";
import { ProofChips } from "@/components/proof-chips";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  techArticle,
} from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Evidence pack",
  description:
    "The proof artifacts a security review asks for, already shipped: OSCAL v1.2.2 conformance in CI, the standards gate, byte-identical registry provenance, per-package test suites, real S3 Object-Lock WORM proofs, and adversarial threat registers. Hand this to your security reviewer.",
  path: "/evidence",
});

// Each artifact is real and runs today. Bodies are true-to-code (copy law ADR-0080): described from
// the workflow / package that produces them, never a fabricated claim or metric. proof strings are a
// verifiable one-liner, not a customer number.
const ARTIFACTS: readonly {
  icon: IconName;
  label: string;
  body: string;
  proof: string;
}[] = [
  {
    icon: "file-check",
    label: "OSCAL conformance in CI",
    body: "The evidence-pack generator exports assessment results, plans of action & milestones, and per-framework assessment plans (SOC 2, HIPAA, EU AI Act) as OSCAL v1.2.2. A CI job installs the NIST oscal-cli and runs a JSON → XML → schema-validate round-trip against the models on every push and pull request — real schema validation, not a self-asserted badge.",
    proof: "oscal-cli 3.2.0 · OSCAL 1.2.2 · JSON → XML → validate",
  },
  {
    icon: "shield",
    label: "The standards gate",
    body: "One gate is the sole registry ingress and license authority. It enforces that every code-shipping module declares Apache-2.0 in its SPDX license field and carries a manifest, and that the catalog the CLI reads matches the workspace's package.json versions exactly. A finding exits non-zero.",
    proof: "SPDX license present · catalog == workspace versions",
  },
  {
    icon: "audit-chain",
    label: "Catalog provenance",
    body: "The module catalog the generator validates against is never hand-edited. Every CLI build derives it from the packages in the repository: each published package at its package.json version, with its manifest's description and dependencies. A test fails the build if the catalog misses a package or carries a version its package.json doesn't.",
    proof: "catalog == workspace package.json versions",
  },
  {
    icon: "check",
    label: "Per-package test suites",
    body: "Every package ships its own suite — unit tests, Postgres integration tests on an in-process PGlite database, and golden-file regression compared with drift failing the build. The whole workspace runs green on every push; a single failing test reddens the run. Cross-tenant isolation is one of those tests, not a convention.",
    proof: "unit · PGlite integration · golden-file — green on every push",
  },
  {
    icon: "worm",
    label: "WORM live proofs",
    body: "A live-verification harness runs against a real S3 Object-Lock bucket and asserts the guarantee end to end: a write succeeds and reads back a real retention date, a duplicate write is refused with a real HTTP 412 (write-once), a retention extension lands a later date, and an attempt to shorten it is refused while the lock still holds. It runs against real cloud storage — not a mock.",
    proof: "S3 Object-Lock · write-once 412 · extend · never-shorten",
  },
  {
    icon: "evidence-pack",
    label: "Adversarial threat registers",
    body: "Each workstream ships a SECURITY.md threat register produced by an adversarial review lane: every threat is enumerated and marked held or refuted, with the resolution. The shared-substrate register alone covers per-tenant key derivation, nonce reuse, the KMS envelope, and the RLS boundary. These are the working security records behind the code, in the public repository.",
    proof: "per-workstream SECURITY.md · each threat held or refuted",
  },
];

const FAQ = [
  {
    question: "Can I see the evidence pack before I adopt Caisson?",
    answer:
      "The artifacts described here are real and run in CI today. The source — including the evidence-pack generator, the OSCAL export, and the test suites — is in the public repository under Apache-2.0, and we will walk your security reviewer through the CI runs and threat registers directly. Email security@caisson.sh to start that conversation.",
  },
  {
    question: "Is Caisson SOC 2 or HIPAA certified?",
    answer:
      "No. Caisson is a codebase, not an auditor. It ships the technical controls those frameworks require and generates the OSCAL-mapped evidence pack you hand your auditor; the certification, and your organizational controls, remain yours. The /security and /compliance pages draw that boundary in detail.",
  },
  {
    question: "Do these checks block a merge?",
    answer:
      "They run in CI on every push and pull request, and the project treats them as required before code lands. They are the same runs — OSCAL conformance, the standards gate, registry byte-identity, and the full test suite — that produce every artifact on this page.",
  },
] as const;

export default function EvidencePage() {
  const jsonLd = [
    breadcrumb([
      { name: "Home", path: "/" },
      { name: "Evidence pack", path: "/evidence" },
    ]),
    techArticle({
      headline: "Caisson evidence pack",
      description:
        "The already-shipped proof artifacts a security review asks for: OSCAL conformance CI, the standards gate, registry provenance, test suites, WORM live proofs, and threat registers.",
      url: `${SITE_URL}/evidence`,
    }),
    faqPage([...FAQ]),
  ];

  return (
    <>
      {jsonLd.map((node) => (
        <script
          key={node["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}

      <Hero
        eyebrow="Evidence pack"
        title="The evidence, before you ask for it."
        lede="A security review gates on proof. Caisson already ships every artifact it asks for — OSCAL conformance, a license and provenance gate, tested controls, real WORM verification, and adversarial threat registers — the failure was surfacing them. Here they are. Hand this page to your security reviewer."
        ctas={
          <>
            <Button href="mailto:security@caisson.sh" external>
              Walk my reviewer through it
            </Button>
            <Button href="/security" variant="ghost">
              This site's security posture
            </Button>
          </>
        }
        credentials={
          <ProofChips
            items={[
              "OSCAL 1.2.2 in CI",
              "Standards gate",
              "Registry byte-identity",
              "S3 Object-Lock proofs",
            ]}
            note="Already shipped and running in CI — not a roadmap."
          />
        }
      />

      {/* ===== The artifacts ===== */}
      <Reveal>
        <Section
          band="tint"
          eyebrow="What already ships"
          title="Six proof artifacts, each running today."
          lede="Every card is a control that runs in CI or a record that ships with the source — described from the workflow or package that produces it. Nothing here is a promise; it is the pipeline."
        >
          <div className="cs-grid" style={{ marginTop: "var(--cs-space-8)" }}>
            {ARTIFACTS.map((a, i) => (
              <Reveal as="article" key={a.label} delay={i * 60}>
                <Card>
                  <div className="cs-status">
                    <Icon name={a.icon} size="lg" />
                    {a.label}
                  </div>
                  <p
                    className="cs-muted"
                    style={{ marginTop: "var(--cs-space-3)", maxWidth: "70ch" }}
                  >
                    {a.body}
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
                      overflowWrap: "anywhere",
                    }}
                  >
                    {a.proof}
                  </code>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
      </Reveal>

      {/* ===== The Living Chain (ADR-0334 moment 4 — flagship) ===== */}
      <Section
        eyebrow="The chain, live"
        title="Watch the audit chain build itself."
        lede="This is the shipped ChainViewer over a genuine kernel-built hash chain — each append links to the last by SHA-256, and verifyChain stamps the verdict. Scroll it into existence; the hashes are real either way."
      >
        <div style={{ marginTop: "var(--cs-space-8)" }}>
          <LivingChainSection />
        </div>
      </Section>

      {/* ===== How to get it ===== */}
      <Reveal>
        <Section
          eyebrow="For your security reviewer"
          title="You own the source, so the evidence comes with it."
          lede="These artifacts aren't a hosted dashboard you rent access to. They live in the codebase you can read and run — the generator that writes the OSCAL pack, the gate that enforces the license floor, the suites that prove the controls. Read them, run them, and put your own reviewer's name on the result."
        >
          <FeatureGridSafe />
        </Section>
      </Reveal>

      {/* ===== FAQ (visible + JSON-LD) ===== */}
      <Reveal>
        <Section
          band="surface"
          eyebrow="What a reviewer asks"
          title="Straight answers about the evidence."
        >
          <Faq items={FAQ} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>
    </>
  );
}

// A small local grid of the three public surfaces a reviewer starts from — kept inline (single use)
// rather than a shared component. Every target is a live page on this site.
function FeatureGridSafe() {
  const links: readonly { href: string; label: string; note: string }[] = [
    {
      href: "/security",
      label: "Security posture",
      note: "The shipped controls, this site's own posture, and the CSP — stated precisely, residuals included.",
    },
    {
      href: "/compliance",
      label: "Compliance controls",
      note: "The evidence-pack generator, the OSCAL v1.2.2 export, and the technical-versus-administrative boundary.",
    },
    {
      href: "/docs",
      label: "The docs",
      note: "How every package works and the contract it upholds — the manual your engineers read before they wire it in.",
    },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
        gap: "var(--cs-space-4)",
        marginTop: "var(--cs-space-8)",
      }}
    >
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <Card interactive>
            <span className="cs-card-title">{l.label}</span>
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
              {l.note}
            </p>
          </Card>
        </Link>
      ))}
      <div style={{ gridColumn: "1 / -1", marginTop: "var(--cs-space-4)" }}>
        <div className="cs-cta-row">
          <Button href="mailto:security@caisson.sh" external variant="primary">
            security@caisson.sh
          </Button>
          <Button href="/docs/getting-started" variant="ghost">
            Try it on your stack
          </Button>
        </div>
      </div>
    </div>
  );
}
