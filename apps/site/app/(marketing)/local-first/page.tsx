import {
  Button,
  Card,
  Hero,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
} from "@/components";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import { breadcrumb, serializeJsonLd, softwareApplication } from "@/lib/jsonld";

export const metadata = buildMetadata({
  title: "Local-first AI",
  description:
    "Compute seam, default-deny privacy gate, on-device vector search with sqlite-vec, and offline license verification — free under AGPL, available on GitHub now.",
  path: "/local-first",
});

const GITHUB_URL = "https://github.com/GridWork-dev/caisson";
const PAGE_URL = `${SITE_URL}/local-first`;

const ldApp = softwareApplication({
  name: "Caisson Local-first AI",
  description:
    "A composable compute seam, default-deny privacy gate, on-device vector search (sqlite-vec), and offline license verification. Free under AGPL-3.0.",
  url: PAGE_URL,
  // No priceId — free tier carries no offer price
});

const ldBreadcrumb = breadcrumb([
  { name: "Caisson", path: "/" },
  { name: "Local-first AI", path: "/local-first" },
]);

// Four pieces, each tied to a canonical icon from the design system
const PIECES = [
  {
    icon: "server" as const,
    label: "Compute seam",
    body: "One interface over local and hosted inference. Local is the default you ship; hosted is an opt-in you make on purpose — not a default you discover in a network trace.",
  },
  {
    icon: "lock" as const,
    label: "Privacy gate",
    body: "A policy boundary every payload crosses before it can leave the process. Default-deny by host: nothing egresses unless you allowed that destination in writing.",
  },
  {
    icon: "database" as const,
    label: "On-device vector search",
    body: "Embeddings indexed with sqlite-vec ANN, queried on disk. Semantic recall with zero round-trips to a vector cloud and nothing to leak from one.",
  },
  {
    icon: "cpu" as const,
    label: "Offline license",
    body: "License verification that works air-gapped — signature-checked on the device, no phone-home, no remote kill switch. The library keeps running when the network does not.",
  },
] as const;

export default function LocalFirstPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldBreadcrumb) }}
      />

      {/* ===== Hero ===== */}
      <Hero
        eyebrow="Local-first AI · Open core"
        title="Your data never leaves the device."
        lede="Inference, embeddings, and search that run on the machine in front of you. Sovereignty is the default — not a setting you harden in later. The egress is zero because there is no outbound call to make."
        ctas={
          <>
            <Button href={GITHUB_URL} variant="primary" external>
              View on GitHub
            </Button>
            <Button href="/docs/local-first" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={<StatusChip tone="success" label="Free · AGPL-3.0" dot />}
        artifact={
          <Terminal
            label="caisson where-compute"
            status={<StatusChip tone="success" label="local-only" dot />}
          >
            {"$ caisson where-compute\n"}
            <span className="cs-tok-accent">{"seam      "}</span>
            {"local          "}
            <span className="cs-tok-muted">
              {"# swappable; hosted is opt-in\n"}
            </span>
            <span className="cs-tok-accent">{"embed     "}</span>
            {"sqlite-vec     "}
            <span className="cs-tok-muted">{"# ANN index on disk\n"}</span>
            <span className="cs-tok-accent">{"license   "}</span>
            {"offline        "}
            <span className="cs-tok-muted">
              {"# verifies air-gapped, no phone-home\n"}
            </span>
            <span className="cs-tok-accent">{"egress    "}</span>
            <span className="cs-tok-success">{"none"}</span>
            {"           "}
            <span className="cs-tok-muted">{"# 0 outbound connections"}</span>
          </Terminal>
        }
      />

      {/* ===== Open on GitHub NOW — resolve the AGPL contradiction ===== */}
      <Section
        eyebrow="Open core · AGPL-3.0"
        title="On GitHub. Free. Now."
        lede={
          <>
            <code className="mono">@caisson/local-first</code> is available
            today on GitHub under AGPL-3.0 — read it, fork it, run it
            air-gapped. The paid editions (Compliance, AI Production Kit,
            Agentic-Dev) are early-access and carry commercial terms. The
            local-first flank is free on purpose.
          </>
        }
        band="tint"
      >
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            marginTop: "var(--cs-space-6)",
            flexWrap: "wrap",
          }}
        >
          <Button href={GITHUB_URL} variant="primary" external>
            GridWork-dev/caisson on GitHub
          </Button>
          <Button href="/editions" variant="ghost">
            Compare editions
          </Button>
        </div>
        <Terminal
          label="package @caisson/local-first"
          status={<StatusChip tone="success" label="available now" dot />}
        >
          <span className="cs-tok-muted">{"package   "}</span>
          {"@caisson/local-first\n"}
          <span className="cs-tok-muted">{"license   "}</span>
          <span className="cs-tok-accent">{"AGPL-3.0-only"}</span>
          {"\n"}
          <span className="cs-tok-muted">{"source    "}</span>
          {"github.com/GridWork-dev/caisson\n"}
          <span className="cs-tok-muted">{"status    "}</span>
          <span className="cs-tok-success">{"available now"}</span>
          {"\n"}
          <span className="cs-tok-muted">{"terms     "}</span>
          {"free · forever · network use carries source obligations"}
        </Terminal>
      </Section>

      {/* ===== Four pieces ===== */}
      <Reveal>
        <Section
          eyebrow="What's in the flank"
          title="Four pieces. All on the device."
          lede="Each module is built to do its job without a network. Compose them, or take a single package — the data path never widens past the disk."
        >
          <div
            className="cs-grid cs-grid--2"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {PIECES.map((p) => (
              <Card key={p.label}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cs-space-3)",
                    marginBottom: "var(--cs-space-3)",
                  }}
                >
                  <Icon name={p.icon} size="md" aria-label={p.label} />
                  <span
                    style={{
                      fontWeight: "var(--cs-weight-semibold)",
                      fontSize: "var(--cs-text-base)",
                    }}
                  >
                    {p.label}
                  </span>
                </div>
                <p className="cs-muted">{p.body}</p>
              </Card>
            ))}
          </div>
        </Section>
      </Reveal>

      {/* ===== On-device vector search evidence ===== */}
      <Reveal>
        <Section
          eyebrow="On-device vector search"
          title="Semantic recall that never round-trips."
          lede="sqlite-vec holds the ANN index next to your rows. A query is a statement against a local file — no API key, no vector vendor, no embeddings shipped off the box to be indexed by someone else."
          band="surface"
        >
          <Terminal
            label="sqlite-vec ANN query"
            status={<StatusChip tone="muted" label="0 outbound connections" />}
          >
            <span className="cs-tok-muted">
              {"-- ANN over the local store; nothing leaves the process\n"}
            </span>
            <span className="cs-tok-accent">{"SELECT"}</span>
            {" id, distance\n"}
            <span className="cs-tok-accent">{"FROM"}</span>
            {"   cs_cards\n"}
            <span className="cs-tok-accent">{"WHERE"}</span>
            {"  embedding "}
            <span className="cs-tok-accent">{"MATCH"}</span>
            {" :query_vec\n"}
            <span className="cs-tok-accent">{"ORDER"}</span>
            {"  "}
            <span className="cs-tok-accent">{"BY"}</span>
            {" distance\n"}
            <span className="cs-tok-accent">{"LIMIT"}</span>
            {"  8;\n"}
            <span className="cs-tok-muted">
              {"-- index on disk · 0 outbound connections"}
            </span>
          </Terminal>
        </Section>
      </Reveal>

      {/* ===== Privacy gate deep-dive ===== */}
      <Reveal>
        <Section
          eyebrow="Default-deny privacy gate"
          title="Nothing egresses unless you said so."
          lede="The privacy gate is a policy boundary every payload must cross before it can reach a network socket. Hosts are deny-listed by default; you allow them in a typed config, not at call-time in an if-block someone forgets to update."
        >
          <Terminal
            label="privacy-gate config"
            status={<StatusChip tone="accent" label="deny-all default" dot />}
          >
            <span className="cs-tok-muted">{"// caisson.config.ts\n"}</span>
            <span className="cs-tok-accent">{"privacyGate"}</span>
            {": {\n"}
            {"  "}
            <span className="cs-tok-muted">
              {"// default: deny all hosts\n"}
            </span>
            {"  "}
            <span className="cs-tok-accent">{"allowHosts"}</span>
            {": [\n"}
            {"    "}
            <span className="cs-tok-success">
              {'"api.internal.example.com"'}
            </span>
            {",\n"}
            {"  ],\n"}
            {"  "}
            <span className="cs-tok-accent">{"onViolation"}</span>
            {": "}
            <span className="cs-tok-danger">{'"throw"'}</span>
            {",  "}
            <span className="cs-tok-muted">
              {"// fail-closed by construction\n"}
            </span>
            {"}"}
          </Terminal>
        </Section>
      </Reveal>

      {/* ===== Paid editions CTA (scoped — not confused with the free tier) ===== */}
      <Reveal>
        <Section
          eyebrow="Paid editions — early access"
          title="Need compliance controls or a hosted inference layer?"
          lede="The paid editions — Compliance, AI Production Kit, and Agentic-Dev — extend the open core with commercial modules: fail-closed RLS, WORM audit chain, hosted inference routing, and agentic scaffolding. Early-access slots are open."
          band="tint"
        >
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-3)",
              marginTop: "var(--cs-space-6)",
              flexWrap: "wrap",
            }}
          >
            <Button href="/editions" variant="primary">
              Compare editions
            </Button>
            <Button href="/pricing" variant="ghost">
              See pricing
            </Button>
          </div>
        </Section>
      </Reveal>
    </>
  );
}
