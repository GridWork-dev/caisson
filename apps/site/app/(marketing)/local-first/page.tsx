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
import { AddToCartButton } from "@/components/add-to-cart-button";
import { editionCatalogItem, toCartItem } from "@/lib/catalog";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import { breadcrumb, serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { formatPrice, priceById } from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Local-first AI",
  description:
    "Own the source. On-device inference behind a compute seam, a default-deny privacy gate, and on-device vector search with sqlite-vec — your data never leaves the device.",
  path: "/local-first",
});

const PAGE_URL = `${SITE_URL}/local-first`;
const localFirstPrice = priceById("local-first");

// Cart-ready CatalogItem for the peak-intent buy CTAs below (ADR-0192 single add-to-cart buy-verb).
const _catalogItem = editionCatalogItem("local-first");
const editionCartItem = _catalogItem ? toCartItem(_catalogItem) : undefined;

const ldApp = softwareApplication({
  name: "Caisson Local-first AI",
  description:
    "Own the source: a composable compute seam over on-device and hosted inference, a default-deny privacy gate, and on-device vector search (sqlite-vec). Your data never leaves the device.",
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
    body: "One interface over on-device and hosted inference. Local is the default you ship; hosted is an opt-in you make on purpose — not a default you discover in a network trace.",
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
        eyebrow="Local-first AI · Own the source"
        title="Your data never leaves the device."
        lede="Inference, embeddings, and search that run on the machine in front of you. Sovereignty is the default — not a setting you harden in later. The egress is zero because there is no outbound call to make."
        ctas={
          <>
            {editionCartItem && (
              <AddToCartButton item={editionCartItem} variant="primary" />
            )}
            <Button href="/docs/local-first" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={
          <StatusChip
            tone="accent"
            label={
              localFirstPrice
                ? `Own the source · ${formatPrice(localFirstPrice)}`
                : "Own the source"
            }
            dot
          />
        }
        artifact={
          <Terminal
            label="@caisson/field-crypto"
            status={<StatusChip tone="success" label="sealed per-tenant" dot />}
          >
            <span className="cs-tok-muted">
              {'import { TenantFieldCrypto } from "@caisson/field-crypto"\n\n'}
            </span>
            <span className="cs-tok-accent">{"const"}</span>
            {" env = "}
            <span className="cs-tok-accent">{"await"}</span>
            {' fc.encryptField(tenant, "record", "notes")\n'}
            <span className="cs-tok-muted">
              {"// v1 · aes-256-gcm · per-tenant key · AAD-bound  "}
            </span>
            <span className="cs-tok-success">{"← sealed at rest\n\n"}</span>
            <span className="cs-tok-accent">{"await"}</span>
            {" fc.decryptField(otherTenant, env, "}
            <span className="cs-tok-accent">{'"notes"'}</span>
            {")\n"}
            <span className="cs-tok-muted">
              {"// cross-tenant key — open "}
            </span>
            <span className="cs-tok-danger">{"refused"}</span>
            <span className="cs-tok-muted">{"  ← isolation proof"}</span>
          </Terminal>
        }
      />

      {/* ===== Four pieces ===== */}
      <Reveal>
        <Section
          eyebrow="What's in the edition"
          title="Four pieces. All on the device."
          lede="Each piece does its job without a network. Compose them, or take a single module — the data path never widens past the disk."
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

      {/* ===== On-device vector search (illustrative shape) ===== */}
      <Reveal>
        <Section
          eyebrow="On-device vector search"
          title="Semantic recall that never round-trips."
          lede="sqlite-vec holds the ANN index next to your rows. A query is a statement against a local file — no API key, no vector vendor, no embeddings shipped off the box to be indexed by someone else. The shape below is illustrative."
          band="surface"
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

      {/* ===== Get started ===== */}
      <Reveal>
        <Section
          eyebrow="Get started"
          title="Own the source. Run it on your machine."
          lede="Local-first AI is a commercial edition — own the source, ship on-device inference behind the privacy gate, and keep your data on the box. Scaffold the base, then add the edition."
          band="tint"
        >
          <Terminal
            label="install"
            status={<StatusChip tone="muted" label="scaffold" />}
          >
            <span className="cs-tok-muted">{"$ "}</span>
            {"npx "}
            <span className="cs-tok-accent">{"create-caisson"}</span>
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
            {editionCartItem && (
              <AddToCartButton item={editionCartItem} variant="primary" />
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
