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
} from "@/components";
import { TrialPath } from "@/components/trial-path";
import { breadcrumb, faqPage, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import { MODULE_PRICES } from "@/lib/pricing";
import { MODULE_DB_POSTURE, POSTURE_GROUPS, STACK_AXES } from "@/lib/stack-fit";

export const metadata = buildMetadata({
  title: "Does it fit my stack?",
  description:
    "The honest adapter matrix: which Caisson modules need Postgres and which don't, the Drizzle and Prisma bridges, better-auth or your own provider, S3 / GCS / R2 WORM backends, the AI-provider lanes, and the MCP transports — verified against the code.",
  path: "/stack-fit",
});

const FAQ = [
  {
    question: "Do I have to switch ORMs to use Caisson?",
    answer:
      "No. The Drizzle and Prisma bridges route the SQL your query builder already generates through the fail-closed tenant executor — a rename at the call site, not a rewrite. Neither bridge adds a runtime dependency on drizzle-orm or @prisma/client; row-level security still enforces isolation underneath.",
  },
  {
    question: "Does every module need Postgres?",
    answer:
      "No. The tenant-isolation, metering, and ledger modules build on Postgres row-level security by design — that is where the isolation guarantee lives. The local-first modules run on SQLite on-device, and the crypto, in-process, and on-device-inference modules ship no database of their own. The table on this page lists every module's posture.",
  },
  {
    question: "Can I bring my own auth provider?",
    answer:
      "Yes. The base depends only on a provider-agnostic SessionProvider port; better-auth is the reference implementation, wired for magic-link, email/password, and env-gated GitHub, Google, and Discord OAuth. Swap in your own provider without touching the tenancy, billing, or credits packages.",
  },
  {
    question: "Which object-storage backends does WORM support?",
    answer:
      "AWS S3 Object-Lock (per-object, in GOVERNANCE or COMPLIANCE mode), Google Cloud Storage (per-object retention lock), and Cloudflare R2 (bucket-level lock rules), behind one ArtifactStore port. R2 enforces retention at the bucket-rule level rather than per object, and the adapter fails closed if the key prefix is not covered by an enabled rule.",
  },
] as const;

// Modules in a given posture bucket, in catalog order — read from MODULE_PRICES so labels never drift.
function modulesInPosture(posture: string) {
  return MODULE_PRICES.filter((m) => MODULE_DB_POSTURE[m.id] === posture);
}

export default function StackFitPage() {
  const ldBreadcrumb = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Stack fit", path: "/stack-fit" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqPage([...FAQ])) }}
      />

      <Hero
        eyebrow="Stack fit"
        title="Does it fit my stack?"
        lede="The question that decides a build-vs-buy call — answered honestly, per axis, against the code. Caisson runs on plain Next.js and Postgres, bridges to your ORM, takes your auth provider, and hardcodes no infrastructure. Where a backend has a real limit, it is stated here, not hidden."
        ctas={
          <>
            <Button href="/docs/cli/create-caisson" variant="primary">
              Scaffold and test the fit
            </Button>
            <Button href="/compare" variant="ghost">
              Compare the alternatives
            </Button>
          </>
        }
      />

      {/* ===== The adapter axes ===== */}
      <Reveal>
        <Section
          eyebrow="Adapters"
          title="Six seams, no hardcoded infrastructure."
          lede="Each row is what actually ships. The seams are ports you swap — an ORM bridge, an auth provider, a storage backend, an AI lane, an MCP transport — not assumptions baked into the source."
        >
          <div className="cs-grid" style={{ marginTop: "var(--cs-space-8)" }}>
            {STACK_AXES.map((a) => (
              <Reveal as="article" key={a.title}>
                <Card>
                  <div className="cs-status">
                    <Icon name={a.icon} size="lg" />
                    {a.title}
                  </div>
                  <p
                    style={{
                      marginTop: "var(--cs-space-3)",
                      fontWeight: "var(--cs-weight-medium)",
                    }}
                  >
                    {a.fit}
                  </p>
                  <ul
                    style={{
                      margin: "var(--cs-space-4) 0 0",
                      padding: 0,
                      listStyle: "none",
                      display: "grid",
                      gap: "var(--cs-space-2)",
                    }}
                  >
                    {a.supported.map((s) => (
                      <li
                        key={s}
                        className="cs-muted"
                        style={{
                          display: "flex",
                          gap: "var(--cs-space-2)",
                          fontSize: "var(--cs-text-sm)",
                          lineHeight: "var(--cs-leading-snug)",
                        }}
                      >
                        <Icon name="check" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                  <p
                    className="cs-footnote"
                    style={{
                      marginTop: "var(--cs-space-4)",
                      maxWidth: "60ch",
                    }}
                  >
                    {a.note}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
      </Reveal>

      {/* ===== Database posture ===== */}
      <Reveal>
        <Section
          band="surface"
          eyebrow="Database posture"
          title="Which modules need Postgres — and which don't."
          lede="The base substrate's tenant isolation is Postgres row-level security, so the compliance and multi-tenant story is Postgres. But most modules add a capability without pulling in a database of their own. Here is the honest split."
        >
          <FeatureGrid cols={3}>
            {POSTURE_GROUPS.map((g) => {
              const mods = modulesInPosture(g.posture);
              return (
                <Card key={g.posture}>
                  <div className="cs-status">
                    <Icon name={g.icon} size="lg" />
                    {g.heading}
                  </div>
                  <p
                    className="cs-muted"
                    style={{
                      marginTop: "var(--cs-space-3)",
                      fontSize: "var(--cs-text-sm)",
                    }}
                  >
                    {g.note}
                  </p>
                  <ul
                    style={{
                      margin: "var(--cs-space-4) 0 0",
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "var(--cs-space-2)",
                    }}
                  >
                    {mods.map((m) => (
                      <li key={m.id}>
                        <StatusChip label={m.label} tone="muted" />
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </FeatureGrid>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            retention-runner needs Postgres transitively — it schedules through
            the pg-boss job queue.{" "}
            <Link
              href="/marketplace?type=modules"
              style={{ color: "var(--cs-link)" }}
            >
              Browse every module
            </Link>
          </p>
        </Section>
      </Reveal>

      {/* ===== Prove fit in week one ===== */}
      <Reveal>
        <Section
          eyebrow="Trial path"
          title="Don't take our word for the fit. Run it."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <TrialPath />
          </div>
        </Section>
      </Reveal>

      {/* ===== FAQ ===== */}
      <Reveal>
        <Section
          band="tint"
          eyebrow="Stack-fit FAQ"
          title="The integration questions, answered."
        >
          <Faq items={FAQ} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>
    </>
  );
}
