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
import { AddToCartButton } from "@/components/add-to-cart-button";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { bundleCatalogItem, toCartItem } from "@/lib/catalog";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { BUNDLE_MARKS, moduleMark } from "@/lib/marks";
import { bundlePrice, formatUsd, MODULE_PRICES } from "@/lib/pricing";
import { TrackView } from "@/components/track-view";

const LOCAL_FIRST_DESCRIPTION =
  "Local-first AI composes on-device ONNX inference, a zero-egress privacy gate, offline sync, and hybrid sqlite-vec + FTS5 search into one Caisson bundle ($629 one-time, own the source).";

export const metadata = buildMetadata({
  title: "Local-first AI",
  description: LOCAL_FIRST_DESCRIPTION,
  path: "/local-first",
});

const PAGE_URL = `${SITE_URL}/local-first`;

// Cart-ready CatalogItem for the peak-intent buy CTAs below (ADR-0192 single add-to-cart buy-verb).
const _catalogItem = bundleCatalogItem("local-first");
const bundleCartItem = _catalogItem ? toCartItem(_catalogItem) : undefined;

const ldApp = softwareApplication({
  name: "Caisson Local-first AI",
  description: LOCAL_FIRST_DESCRIPTION,
  url: PAGE_URL,
  priceId: "local-first",
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
    icon: "cpu" as const,
    label: "Offline license",
    body: "License verification that works air-gapped: signature-checked on the device, no phone-home, no remote kill switch. The library keeps running when the network does not.",
  },
] as const;

// Base substrate predates the F6 sellable-module mark set — kernel and license-verify never got a
// standalone SKU or bespoke mark, so they resolve through this local map (matches the compliance/
// ai-kit/agentic-dev pages' same-shaped exception). Sellable members resolve via `moduleMark`.
const BASE_MEMBER_ICON: Record<string, IconName> = {
  kernel: "caisson",
  "license-verify": "key",
};

// The bundle's real composed packages (record: edition-local-ai.json memberModules — keyed by
// `name` there, e.g. "@caisson/local-store"; the id is that name with the scope stripped). Priced
// via a StatusChip when the package is also sold standalone (`MODULE_PRICES`), linking to its
// module depth page; kernel and license-verify are Apache-2.0 base and render unpriced.
const MEMBER_MODULES: readonly {
  id: string;
  name: string;
  oneLiner: string;
}[] = [
  {
    id: "local-store",
    name: "@caisson/local-store",
    oneLiner:
      "Hybrid retrieval: sqlite-vec ANN plus FTS5, merged by Reciprocal-Rank-Fusion, with an FTS-only fallback if the vector leg fails.",
  },
  {
    id: "license-verify",
    name: "@caisson/license-verify",
    oneLiner:
      "Offline Ed25519 license verification: checks the signature on the device, fails safe to the community tier if it cannot verify.",
  },
  {
    id: "field-crypto",
    name: "@caisson/field-crypto",
    oneLiner:
      "Per-tenant field encryption: HKDF key derivation plus AES-256-GCM, sealed at rest under a key a different tenant's file cannot open.",
  },
  {
    id: "local-inference",
    name: "@caisson/local-inference",
    oneLiner:
      "The InferenceBackend seam over a MiniLM-class ONNX model via transformers.js, SHA-256 hash-verified before use — on-device by default.",
  },
  {
    id: "local-privacy",
    name: "@caisson/local-privacy",
    oneLiner:
      "A default-deny egress boundary every payload crosses before it can leave the process — an empty allowlist means zero egress.",
  },
  {
    id: "local-sync",
    name: "@caisson/local-sync",
    oneLiner:
      "Two-way offline sync: changesets, tombstones, a logical clock, and a reconcile pass with a convergence test.",
  },
  {
    id: "kernel",
    name: "@caisson/kernel",
    oneLiner:
      "The governance kernel underneath every bundle: typed config, the shared error model, and security primitives.",
  },
];

function MemberModuleCard({
  id,
  name,
  oneLiner,
}: {
  id: string;
  name: string;
  oneLiner: string;
}) {
  const price = MODULE_PRICES.find((m) => m.id === id);
  const icon = BASE_MEMBER_ICON[id] ?? moduleMark(id);
  const card = (
    <Card interactive={price !== undefined}>
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
      {price && (
        <div style={{ marginTop: "var(--cs-space-4)" }}>
          <StatusChip label={formatUsd(price.amount)} tone="muted" />
        </div>
      )}
    </Card>
  );
  return price ? (
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

// Record: edition-local-ai.json faq.
const FAQ_ITEMS = [
  {
    question: 'Does "own the source" rule out hosted inference?',
    answer:
      "No. The compute seam supports opt-in rented transports (OpenRouter, Azure OpenAI, and AWS Bedrock) behind the same InferenceBackend interface used on-device. They are off by default; the privacy policy's allowlist is the only way any of those hosts becomes reachable.",
  },
  {
    question: "What does the on-device model need to run?",
    answer:
      "The ONNX backend runs a MiniLM-class model via transformers.js. The @huggingface/transformers runtime is an optional peer you install yourself — it is not bundled in the package — and the model weights are first-run-fetched and SHA-256 hash-verified before use. Air-gapped buyers pre-seed the cache and run fully offline.",
  },
  {
    question: "Can I buy just the vector store instead of the whole bundle?",
    answer:
      "Yes. @caisson/local-store is also sold standalone for $99 — as are on-device inference ($249), the sync engine ($199), and the privacy gate ($99). The full Local-first AI bundle (all seven composed packages, own the source) is $629 one-time.",
  },
] as const;

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
        eyebrow="Local-first AI · Own the source"
        title="Your data never leaves the device."
        lede="The compute seam runs inference on-device by default; the privacy gate makes a hosted call an explicit opt-in, not a default you discover in a network trace. Vector search, sync, and license verification all run against local files — nothing round-trips to a vendor unless you allow it in writing."
        ctas={
          <>
            {bundleCartItem && (
              <AddToCartButton item={bundleCartItem} variant="primary" />
            )}
            <Button href="/docs/local-first" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={
          <StatusChip
            tone="accent"
            label={`Own the source · ${bundlePrice("local-first")}`}
            dot
          />
        }
        artifact={
          <Terminal
            label="@caisson/field-crypto"
            status={<StatusChip tone="success" label="sealed per-tenant" dot />}
          >
            <span className="cs-tok-muted">
              {
                'import {\n  TenantFieldCrypto,\n} from\n  "@caisson/field-crypto"\n\n'
              }
            </span>
            <span className="cs-tok-accent">{"const"}</span>
            {" env = "}
            <span className="cs-tok-accent">{"await\n  "}</span>
            {'fc.encryptField(\n  tenant, "record", "notes")\n'}
            <span className="cs-tok-muted">
              {"// v1 · aes-256-gcm ·\n// per-tenant key ·\n// AAD-bound  "}
            </span>
            <span className="cs-tok-success">{"← sealed\n// at rest\n\n"}</span>
            <span className="cs-tok-accent">{"await"}</span>
            {" fc.decryptField(\n  otherTenant, env, "}
            <span className="cs-tok-accent">{'"notes"'}</span>
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
        eyebrow="The compute seam"
        title="On-device by default, hosted by opt-in."
        lede="@caisson/local-ai composes local-store, license-verify, field-crypto, and kernel, then adds an InferenceBackend port on top. The default backend runs on-device: a MiniLM-class ONNX model via transformers.js, first-run-fetched and SHA-256 hash-verified before it touches your data. Want hosted inference sometimes? The same interface has opt-in rented transports for OpenRouter, Azure OpenAI, and AWS Bedrock — each metered and egress-guarded, each off until you turn it on."
        band="tint"
      />

      {/* ===== Media slot (ADR-0237 F2) ===== */}
      <Section>
        <MediaPlaceholder icon={BUNDLE_MARKS["local-first"]} />
      </Section>

      {/* ===== Four composed packages ===== */}
      <Reveal>
        <Section
          eyebrow="What ships in the box"
          title="Four composed packages."
          lede="Each member is a real workspace dependency. The commercial ones also carry a standalone price; the Apache-2.0 base ships free with every bundle."
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
          eyebrow="What's in the bundle"
          title="Four pieces. All on the device."
          lede="Each piece does its job without a network. Compose them, or take a single module — the data path never widens past the disk."
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
          eyebrow="Zero egress by default"
          title="The only mode is local-only."
          lede="The privacy policy is a closed schema, not a toggle: the only mode is local-only, and there is no hosted mode to accidentally flip, because the enum does not have one — widening it takes an ADR and a schema change, not a config edit. An allowlist is the sole way a host becomes reachable, and only two sink kinds are sanctioned: the model-download host for first-run ONNX fetches, and the rented-backend host for the opt-in hosted lane. Leave the allowlist empty and egress is zero — the air-gap default."
        />
      </Reveal>

      {/* ===== Fail-closed by construction — real built substrate ===== */}
      <Reveal>
        <Section
          eyebrow="Default-deny, by construction"
          title="Fail-closed is how the base already behaves."
          lede="Default-deny is not a promise — it is how the base substrate behaves today. A cross-tenant read is refused at the database, fail-closed by construction. The privacy gate extends that same posture to network egress: hosts are deny-listed by default, allowed only in a typed config."
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

      {/* ===== Search, sync, and licensing — all local ===== */}
      <Reveal>
        <Section
          eyebrow="Search, sync, and licensing"
          title="All local."
          lede="@caisson/local-store gives you hybrid retrieval: sqlite-vec ANN and FTS5 merged by Reciprocal-Rank-Fusion, degrading to an FTS-only path if the vector leg fails — semantic search with nothing indexed by a vector cloud vendor. Isolation is file-per-tenant: the resolved file path is the tenant boundary. On top, the bundle ships a built two-way sync engine (changesets, tombstones, a logical clock, and a reconcile pass with a convergence test) for when a device needs to catch up, plus offline Ed25519 license verification that checks the signature locally with no phone-home and no remote kill switch."
          band="surface"
        />
      </Reveal>

      {/* ===== On-device vector search (illustrative shape) ===== */}
      <Reveal>
        <Section
          eyebrow="On-device vector search"
          title="Semantic recall that never round-trips."
          lede="sqlite-vec holds the ANN index next to your rows. A query is a statement against a local file — no API key, no vector vendor, no embeddings shipped off the box to be indexed by someone else. The shape below is illustrative."
        >
          <Terminal
            label="sqlite-vec ANN — illustrative shape"
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
          eyebrow="Who it's for, and how it ships"
          title="Own the source. Run it on your machine."
          lede="This bundle is for teams that cannot send data off the device — regulated data kept local, air-gapped deployments, embedded and edge tooling, or a product that should not need a network call to work at all. It ships the way every Caisson bundle ships: npx create-caisson@latest scaffolds the base, then you add Local-first AI. Two of its composed packages — kernel and license-verify — are Apache-2.0; local-store, field-crypto, local-inference, local-privacy, and local-sync are the commercial layer the bundle license covers."
          band="tint"
        />
      </Reveal>

      {/* ===== FAQ ===== */}
      <Reveal>
        <Section
          eyebrow="Common questions"
          title="Questions procurement asks first."
        >
          <Faq items={FAQ_ITEMS} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Reveal>
        <Section eyebrow="Get started" title="Own the source." band="surface">
          <Terminal
            label="install"
            status={<StatusChip tone="muted" label="scaffold" />}
          >
            <span className="cs-tok-muted">{"$ "}</span>
            {"bun create "}
            <span className="cs-tok-accent">{"caisson"}</span>
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
            {bundleCartItem && (
              <AddToCartButton item={bundleCartItem} variant="primary" />
            )}
            <Button href="/docs/local-first" variant="ghost">
              Read the docs
            </Button>
          </div>
        </Section>
      </Reveal>
    </>
  );
}
