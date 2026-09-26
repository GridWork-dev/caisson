import Link from "next/link";

import {
  Button,
  Card,
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
import { requireBundlePage, spellCount } from "@/lib/bundle-pages";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { moduleMark } from "@/lib/marks";
import { hasModulePage } from "@/lib/module-pages";
import { TrackView } from "@/components/track-view";

// Hero copy, member list, and FAQ read from the shared bundle content record (lib/bundle-pages.ts);
// the bespoke sections below stay page-local.
const record = requireBundlePage("local-first");

export const metadata = buildMetadata({
  title: record.metaTitle,
  description: record.metaDescription,
  path: "/local-first",
});

const PAGE_URL = `${SITE_URL}/local-first`;

// The gallery viewer for this bundle: its live demo, docs, and members in one place.
const GALLERY_HREF = "/marketplace?view=bundle:local-first";

const ldApp = softwareApplication({
  name: "Caisson Local-first AI",
  description: record.metaDescription,
  url: PAGE_URL,
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
    body: "One interface over on-device and hosted inference. Local is the default you ship; hosted only turns on when you flip it in config, on purpose.",
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
    icon: "git-branch" as const,
    label: "Offline sync",
    body: "A two-way sync engine for devices that drop off the network: changesets, tombstones, a logical clock, and a reconcile pass that converges when the device reconnects.",
  },
] as const;

// Base substrate predates the F6 module mark set — the kernel never got a bespoke mark, so it
// resolves through this local map (matches the compliance/ai-kit/agentic-dev pages' same-shaped
// exception). Every other member resolves via `moduleMark`.
const BASE_MEMBER_ICON: Record<string, IconName> = {
  kernel: "caisson",
};

// The bundle's real composed packages — read from the shared bundle content record, linking to a
// member's module depth page when one exists.
const MEMBER_MODULES = record.members;

function MemberModuleCard({
  id,
  name,
  oneLiner,
}: {
  id: string;
  name: string;
  oneLiner: string;
}) {
  // Linkable is gated on the depth page actually existing — a Link to a missing one 404s (G5).
  const linkable = hasModulePage(id);
  const icon = BASE_MEMBER_ICON[id] ?? moduleMark(id);
  const card = (
    <Card interactive={linkable}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cs-space-3)",
        }}
      >
        <Icon name={icon} size="lg" />
        <span className="cs-card-title mono">{name}</span>
      </div>
      <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
        {oneLiner}
      </p>
    </Card>
  );
  return linkable ? (
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

// Visible FAQ — also the source of the FAQPage JSON-LD; read from the record.
const FAQ_ITEMS = record.faq;

const ldFaq = faqPage(
  FAQ_ITEMS.map((f) => ({ question: f.question, answer: f.answer })),
);

export default function LocalFirstPage() {
  return (
    <>
      <TrackView item="bundle:local-first" />
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldFaq) }}
      />

      {/* ===== Hero ===== */}
      <Hero
        eyebrow={record.hero.eyebrow}
        title={record.hero.title}
        lede={record.hero.lede}
        ctas={
          <>
            <Button href={GALLERY_HREF} variant="primary">
              Run the live demo
            </Button>
            <Button href="/docs/local-first" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={<StatusChip tone="muted" label="Own the source" dot />}
        artifact={
          <Terminal
            label="@caisson-sh/field-crypto"
            status={<StatusChip tone="success" label="sealed per-tenant" dot />}
          >
            <span className="cs-tok-muted">
              {
                'import {\n  TenantFieldCrypto,\n} from\n  "@caisson-sh/field-crypto"\n\n'
              }
            </span>
            <span className="cs-tok-muted">{"const"}</span>
            {" env = "}
            <span className="cs-tok-muted">{"await\n  "}</span>
            {'fc.encryptField(\n  tenant, "record", "notes")\n'}
            <span className="cs-tok-muted">
              {"// v1 · aes-256-gcm ·\n// per-tenant key ·\n// AAD-bound  "}
            </span>
            <span className="cs-tok-success">{"← sealed\n// at rest\n\n"}</span>
            <span className="cs-tok-muted">{"await"}</span>
            {" fc.decryptField(\n  otherTenant, env, "}
            <span className="cs-tok-muted">{'"notes"'}</span>
            {")\n"}
            <span className="cs-tok-muted">
              {"// cross-tenant key —\n// open "}
            </span>
            <span className="cs-tok-danger">{"refused"}</span>
            <span className="cs-tok-muted">{"  ← isolation\n// proof"}</span>
          </Terminal>
        }
      />

      {/* ===== The compute seam ===== */}
      <Section
        title="On-device by default, hosted by opt-in."
        lede="The Local-first bundle composes @caisson-sh/kernel, @caisson-sh/local-store, @caisson-sh/field-crypto, @caisson-sh/local-privacy, @caisson-sh/local-inference, and @caisson-sh/local-sync. @caisson-sh/local-inference provides the InferenceBackend port and runs on-device by default: a MiniLM-class ONNX model via transformers.js, fetched on first use and SHA-256 hash-verified before it touches your data. Hosted inference is explicit opt-in. The same interface offers metered, egress-guarded transports for OpenRouter, Azure OpenAI, and AWS Bedrock, all disabled until configured."
        band="tint"
      />

      {/* ===== Media slot (ADR-0237 F2) ===== */}
      <Section>
        <MediaCarousel
          slides={mediaSlides("bundle", "local-first")}
          label="Local-first bundle media"
        />
      </Section>

      {/* ===== Four composed packages ===== */}
      <Reveal>
        <Section
          title={`${spellCount(MEMBER_MODULES.length)} composed packages.`}
          lede="Each member is a real workspace dependency, composed onto the Apache-2.0 base."
        >
          <FeatureGrid cols={2}>
            {MEMBER_MODULES.map((m) => (
              <MemberModuleCard key={m.id} {...m} />
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Four pieces (capability overview) ===== */}
      <Reveal>
        <Section
          title="Four pieces. All on the device."
          lede="Each piece does its job without a network. Compose them, or take a single module, the data path never widens past the disk."
        >
          <FeatureGrid cols={2}>
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
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Zero egress by default ===== */}
      <Reveal>
        <Section
          title="The only mode is local-only."
          lede="The privacy policy is a closed schema, not a toggle: the only mode is local-only, and there is no hosted mode to accidentally flip, because the enum does not have one (widening it takes a deliberate code change, not a config edit). An allowlist is the sole way a host becomes reachable, and only two sink kinds are sanctioned: the model-download host for first-run ONNX fetches, and the rented-backend host for the opt-in hosted lane. Leave the allowlist empty and egress is zero, the air-gap default."
        />
      </Reveal>

      {/* ===== Fail-closed by construction, real built substrate ===== */}
      <Reveal>
        <Section
          title="Fail-closed is how the base already behaves."
          lede="Default-deny is not a promise, it is how the base substrate behaves today. A cross-tenant read is refused at the database, fail-closed by construction. The privacy gate extends that same posture to network egress: hosts are deny-listed by default, allowed only in a typed config."
        >
          <Terminal
            label="cross-tenant read"
            status={<StatusChip tone="muted" label="denied" dot />}
          >
            <span className="cs-tok-muted">
              {"-- session scoped to tenant A; reach for tenant B's rows\n"}
            </span>
            <span className="cs-tok-accent">{"SELECT"}</span>
            {" * "}
            <span className="cs-tok-accent">{"FROM"}</span>
            {" records "}
            <span className="cs-tok-accent">{"WHERE"}</span>
            {" tenant_id = "}
            <span className="cs-tok-success">{"'tenant_b'"}</span>
            {";\n"}
            <span className="cs-tok-danger">
              {"ERROR:  permission denied for table records\n"}
            </span>
            <span className="cs-tok-muted">
              {'DETAIL: RLS policy "tenant_isolation" forbids the read'}
            </span>
          </Terminal>
        </Section>
      </Reveal>

      {/* ===== Search, sync, and licensing, all local ===== */}
      <Reveal>
        <Section
          title="All local."
          lede="@caisson-sh/local-store gives you hybrid retrieval: sqlite-vec ANN and FTS5 merged by Reciprocal-Rank-Fusion, degrading to an FTS-only path if the vector leg fails, semantic search with nothing indexed by a vector cloud vendor. Isolation is file-per-tenant: the resolved file path is the tenant boundary. On top, the bundle ships a built two-way sync engine (changesets, tombstones, a logical clock, and a reconcile pass with a convergence test) for when a device needs to catch up."
          band="surface"
        />
      </Reveal>

      {/* ===== On-device vector search (illustrative shape) ===== */}
      <Reveal>
        <Section
          title="Semantic recall that never round-trips."
          lede="sqlite-vec holds the ANN index next to your rows. A query is a statement against a local file, no API key, no vector vendor, no embeddings shipped off the box to be indexed by someone else. The shape below is illustrative."
        >
          <Terminal
            label="sqlite-vec ANN, illustrative shape"
            status={<StatusChip tone="muted" label="on-disk index" />}
          >
            <span className="cs-tok-muted">
              {
                "-- ANN over the local store; the index lives next to your rows\n"
              }
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
              {"-- index on disk · nothing shipped to a vector cloud"}
            </span>
          </Terminal>
        </Section>
      </Reveal>

      {/* ===== Who it's for, and how it ships ===== */}
      <Reveal>
        <Section
          title="Own the source. Run it on your machine."
          lede="This bundle is for teams that cannot send data off the device: regulated data kept local, air-gapped deployments, embedded and edge tooling, or a product that should not need a network call to work at all. It ships the way every Caisson bundle ships: bunx @caisson-sh/cli@latest scaffolds the base, then you add Local-first AI."
          band="tint"
        />
      </Reveal>

      {/* ===== FAQ ===== */}
      <Reveal>
        <Section title="Questions procurement asks first.">
          <Faq items={FAQ_ITEMS} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== Prove fit in week one (ADR-0272 §3) ===== */}
      <Reveal>
        <Section
          title="Prove fit in week one."
          lede="Don't take the fit on faith, scaffold the audited base and run it on your own stack."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <TrialPath />
          </div>
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Reveal>
        <Section title="Own the source." band="surface">
          <Terminal
            label="install"
            status={<StatusChip tone="muted" label="scaffold" />}
          >
            <span className="cs-tok-muted">{"$ "}</span>
            {"bunx "}
            <span className="cs-tok-accent">{"@caisson-sh/cli"}</span>
            {"@latest"}
          </Terminal>
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-3)",
              marginTop: "var(--cs-space-6)",
              flexWrap: "wrap",
            }}
          >
            <Button href={GALLERY_HREF} variant="primary">
              Run the live demo
            </Button>
            <Button href="/docs/local-first" variant="ghost">
              Read the docs
            </Button>
          </div>
        </Section>
      </Reveal>
    </>
  );
}
