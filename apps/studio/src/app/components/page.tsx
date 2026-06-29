import {
  Button,
  Card,
  CodeBlock,
  CredentialStrip,
  EditionCard,
  Glyph,
  Hero,
  Icon,
  Reveal,
  Section,
  SkuMatrix,
  StatusChip,
  Terminal,
  Wordmark,
  type IconName,
} from "@caisson/ui/components";

/**
 * Components — the live @caisson/ui gallery (ADR-0099 recipe). Every primitive rendered from the
 * SHIPPED kit (not a studio re-implementation), so this page is the operator's eyes-on surface for
 * the locked component layer before the marketing-site rebuild. The studio chrome (`.shell` / `.panel`
 * / `.section-title`) frames it; the components themselves carry only their own co-located `cs-*` CSS.
 */

const ICONS: IconName[] = [
  "shield",
  "lock",
  "database",
  "terminal",
  "gauge",
  "key",
  "server",
  "cpu",
  "scale",
  "book",
  "wallet",
  "boxes",
  "check",
  "alert",
  "arrow",
  "rls",
  "worm",
  "audit-chain",
  "fail-closed",
  "field-crypto",
  "evidence-pack",
  "caisson",
];

const SKU_COLUMNS = ["Compliance", "AI Kit", "Local-first", "Agentic"] as const;
const SKU_ROWS = [
  { label: "field-crypto", cells: [true, false, true, false] },
  { label: "audit-worm", cells: [true, true, false, false] },
  { label: "ai-config", cells: [false, true, true, true] },
  { label: "mcp-server", cells: [false, true, false, true] },
];

export default function ComponentsGalleryPage() {
  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · components</p>
        <h1 className="page-title" style={{ maxWidth: "20ch" }}>
          The kit, rendered live.
        </h1>
        <p className="lede">
          Every primitive below comes straight from <code>@caisson/ui</code> —
          Radix behavior, co-located CSS reading only <code>var(--cs-*)</code>,
          variants as <code>data-*</code> attributes (ADR-0099). What ships to
          the site is what you see here.
        </p>
      </section>

      {/* Brand */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Brand</h2>
        <div className="panel row" style={{ gap: "var(--cs-space-8)" }}>
          <Wordmark />
          <Wordmark descriptor />
          <Glyph />
        </div>
      </section>

      {/* Icons */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Icons</h2>
        <p className="muted">
          Lucide set + bespoke domain glyphs, one <code>{`<Icon>`}</code>{" "}
          surface (24-grid, 2px stroke, <code>currentColor</code>).
        </p>
        <ul
          className="panel"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
            gap: "var(--cs-space-4)",
            listStyle: "none",
            margin: 0,
          }}
        >
          {ICONS.map((name) => (
            <li
              key={name}
              className="stack"
              style={{
                gap: "var(--cs-space-2)",
                justifyItems: "center",
                textAlign: "center",
              }}
            >
              <Icon name={name} size="lg" aria-label={name} />
              <span className="board-state mono">{name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Buttons */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Button</h2>
        <div className="panel row" style={{ gap: "var(--cs-space-3)" }}>
          <Button>Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="sm">Primary · sm</Button>
          <Button variant="ghost" size="sm">
            Ghost · sm
          </Button>
          <Button disabled>Disabled</Button>
          <Button asChild>
            <a href="/components">As link (asChild)</a>
          </Button>
        </div>
      </section>

      {/* Status chips */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">StatusChip</h2>
        <div className="panel row" style={{ gap: "var(--cs-space-3)" }}>
          <StatusChip tone="accent" label="accent" dot />
          <StatusChip tone="success" label="success" icon="check" />
          <StatusChip tone="muted" label="muted" />
        </div>
      </section>

      {/* Cards */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Card</h2>
        <div className="cols">
          <Card>
            <h3 style={{ marginBottom: "var(--cs-space-2)" }}>Surface card</h3>
            <p className="muted">
              The hairline surface primitive — raised one tonal step, no hover.
            </p>
          </Card>
          <Card>
            <h3 style={{ marginBottom: "var(--cs-space-2)" }}>Second card</h3>
            <p className="muted">
              Composition only; layout lives with the consumer.
            </p>
          </Card>
        </div>
      </section>

      {/* Terminal + CodeBlock */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Terminal · CodeBlock</h2>
        <div className="cols">
          <Terminal
            label="caisson · audit"
            status={<StatusChip tone="success" label="verified" icon="check" />}
          >
            <div className="mono">$ caisson audit verify --chain</div>
            <div className="mono cs-tok-success">
              ✓ 1,402 events · hash chain intact
            </div>
          </Terminal>
          <CodeBlock
            frame
            label="deny.ts"
            status={<StatusChip tone="accent" label="RLS" />}
            code={
              <>
                {"const row = await db.query(/* … */);\n"}
                {"if (!row) throw new "}
                <span className="cs-tok-danger">Forbidden</span>
                {"(); // fail-closed\n"}
                {"return "}
                <span className="cs-tok-accent">withTenant</span>
                {"(ctx, row);"}
              </>
            }
          />
        </div>
        <CodeBlock
          label="bare pre"
          code="caisson init --edition compliance && caisson dev"
        />
      </section>

      {/* Credential strip */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">CredentialStrip</h2>
        <div className="panel">
          <CredentialStrip
            items={["SOC 2", "HIPAA", "GDPR", "ISO 27001"]}
            note="Caisson gives you the controls; certification is your audit."
          />
        </div>
      </section>

      {/* Edition cards */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">EditionCard</h2>
        <div className="cs-editions">
          <EditionCard
            lead
            href="/components"
            name="Compliance"
            icon="shield"
            status={<StatusChip tone="accent" label="edition" />}
            line="Field-crypto, append-only audit, fail-closed RLS — the regulated wedge."
            proof="$ caisson audit verify --chain  ✓ intact"
          />
          <EditionCard
            href="/components"
            name="AI Production Kit"
            icon="cpu"
            status={<StatusChip tone="muted" label="edition" />}
            line="Eval gates, cassette replay, provider-swappable inference."
          />
          <EditionCard
            href="/components"
            name="Local-first AI"
            icon="database"
            status={<StatusChip tone="muted" label="edition" />}
            line="On-device vector + FTS hybrid recall, zero hosted sink."
          />
        </div>
      </section>

      {/* SKU matrix */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">SkuMatrix</h2>
        <div className="panel">
          <SkuMatrix columns={SKU_COLUMNS} rows={SKU_ROWS} />
        </div>
      </section>

      {/* Section bands */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Section (bands)</h2>
        <Section
          flush
          band="surface"
          eyebrow="section · surface band"
          title="A toned section shell"
          lede="Section is pure composition — the shell, eyebrow, title and lede are base.css utilities; the band is a data-* variant."
        />
        <Section
          band="tint"
          eyebrow="section · tint band"
          title="The accent-tint band"
          lede="Same primitive, data-band=tint."
        />
      </section>

      {/* Hero (compact) */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Hero</h2>
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <Hero
            eyebrow="compliance-grade infrastructure"
            title="Ship the controls. Keep the evidence."
            lede="The split marketing header primitive — display title, lede, CTAs, a credential strip, and a framed evidence artifact."
            ctas={
              <>
                <Button>Get Caisson</Button>
                <Button variant="ghost">Read the docs</Button>
              </>
            }
            credentials={
              <CredentialStrip
                items={["SOC 2", "HIPAA", "GDPR"]}
                note="Caisson gives you the controls; certification is your audit."
              />
            }
            artifact={
              <Terminal
                label="caisson · audit"
                status={
                  <StatusChip tone="success" label="verified" icon="check" />
                }
              >
                <div className="mono">$ caisson audit verify --chain</div>
                <div className="mono cs-tok-success">✓ hash chain intact</div>
              </Terminal>
            }
          />
        </div>
      </section>

      {/* Reveal (client island) */}
      <section className="stack" style={{ gap: "var(--cs-space-4)" }}>
        <h2 className="section-title">Reveal</h2>
        <Reveal>
          <div className="panel">
            <p className="muted">
              Fade-up-once on scroll (IntersectionObserver). Gated on{" "}
              <code>.cs-js</code> so content is never stuck at{" "}
              <code>opacity:0</code>; honors <code>prefers-reduced-motion</code>
              .
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
