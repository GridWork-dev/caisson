import Link from "next/link";

import { Button, Card, Hero, Reveal, Section } from "@/components";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";
import { SUBPROCESSORS } from "@/lib/subprocessors";

// The subprocessor table reuses the kit's `cs-matrix` styling (fixed layout, sticky first column,
// scroll frame). Its stylesheet only ships inside the component module, which tree-shaking drops
// from this page's graph — own the dependency explicitly, same as the compare page:
import "@caisson/ui/components/sku-matrix.css";

const STATUS_PAGE_URL = "https://caisson.betteruptime.com";

export const metadata = buildMetadata({
  title: "Trust",
  description:
    "Live and historical availability for the Caisson surfaces you depend on, the third parties that process data for the Caisson service, the shipped security posture, and a security contact — the answers a procurement review asks for, in one place.",
  path: "/trust",
});

// The public surfaces the status page monitors — all live and unauthenticated.
const MONITORED = ["The website", "The registry (module resolution)"] as const;

// The shipped security surfaces, each a live page on this site — stated at its honest grade.
const SECURITY_LINKS: readonly { href: string; label: string; note: string }[] =
  [
    {
      href: "/security",
      label: "Security posture",
      note: "How Caisson secures the controls it generates and this site itself — fail-closed RLS, a resolve-and-recheck SSRF guard, timing-safe secret comparison — with the residuals stated, not hidden.",
    },
    {
      href: "/evidence",
      label: "Evidence pack",
      note: "The proof artifacts a review asks for, already shipped: OSCAL conformance in CI, the standards gate, byte-identical registry provenance, real S3 Object-Lock WORM verification, and the append-only audit chain.",
    },
    {
      href: "/compliance",
      label: "Control coverage",
      note: "The technical controls the SOC 2 and HIPAA frameworks require, and the boundary between what Caisson ships and what stays your organization's responsibility.",
    },
  ];

export default function TrustPage() {
  const jsonLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Trust", path: "/trust" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Hero
        eyebrow="Trust"
        title="Availability, subprocessors, and the security story."
        lede="What a procurement review checks, in one place: live and historical availability for the surfaces a Caisson deployment depends on, the third parties that process data for the Caisson service, the shipped security posture, and a name to email when you need more."
        ctas={
          <>
            <Button href={STATUS_PAGE_URL} external variant="primary">
              Status page
            </Button>
            <Button href="mailto:security@caisson.sh" external variant="ghost">
              security@caisson.sh
            </Button>
          </>
        }
      />

      {/* ===== Availability ===== */}
      <Reveal>
        <Section
          band="tint"
          eyebrow="Availability"
          title="A live status page."
          lede="We publish live status and incident history for the public surfaces a Caisson deployment resolves against. The page shows measured availability — what actually happened — never a promised number."
        >
          <Card accent>
            <p className="cs-status" style={{ color: "var(--cs-accent)" }}>
              Monitored surfaces
            </p>
            <ul
              style={{
                marginTop: "var(--cs-space-4)",
                marginBottom: "var(--cs-space-6)",
                paddingLeft: "var(--cs-space-5)",
                display: "grid",
                gap: "var(--cs-space-2)",
                maxWidth: "60ch",
              }}
            >
              {MONITORED.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <Button href={STATUS_PAGE_URL} external variant="primary">
              Open the status page
            </Button>
          </Card>
        </Section>
      </Reveal>

      {/* ===== Security posture ===== */}
      <Reveal>
        <Section
          eyebrow="Security"
          title="The posture, stated precisely."
          lede="Caisson generates the evidence a security review asks for; it is not an auditor, and never claims to be. The shipped story lives on these pages — read them, run the controls, and put your own reviewer's name on the result."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              gap: "var(--cs-space-4)",
              marginTop: "var(--cs-space-8)",
            }}
          >
            {SECURITY_LINKS.map((l, i) => (
              <Reveal as="article" key={l.href} delay={i * 50}>
                <Link
                  href={l.href}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Card interactive>
                    <span className="cs-card-title">{l.label}</span>
                    <p
                      className="cs-muted"
                      style={{ marginTop: "var(--cs-space-2)" }}
                    >
                      {l.note}
                    </p>
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>

          <div
            style={{
              marginTop: "var(--cs-space-8)",
              display: "flex",
              gap: "var(--cs-space-3)",
              flexWrap: "wrap",
            }}
          >
            <Button
              href="mailto:security@caisson.sh"
              external
              variant="primary"
            >
              Email security@caisson.sh
            </Button>
            <Button href="/.well-known/security.txt" external variant="ghost">
              security.txt
            </Button>
          </div>
        </Section>
      </Reveal>

      {/* ===== Subprocessors ===== */}
      <Section
        eyebrow="Subprocessors"
        title="Who processes what."
        lede="Caisson the product runs inside your own infrastructure, and your application data stays there. The services below process data for the Caisson service itself — this website, email, support, monitoring, and inference — not your application data."
      >
        <div
          className="cs-matrix__frame"
          style={{ marginTop: "var(--cs-space-8)" }}
        >
          <div className="cs-matrix__wrap">
            <table className="cs-matrix">
              <thead>
                <tr>
                  <th scope="col">Processor</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Data categories</th>
                  <th scope="col">Region</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((s) => (
                  <tr key={s.processor}>
                    <th scope="row">{s.processor}</th>
                    <td>{s.purpose}</td>
                    <td>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "var(--cs-space-4)",
                          display: "grid",
                          gap: "var(--cs-space-1)",
                        }}
                      >
                        {s.dataCategories.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </td>
                    <td>{s.region ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p
          className="cs-footnote"
          style={{ marginTop: "var(--cs-space-5)", maxWidth: "70ch" }}
        >
          This list is a maintained artifact: a new external service that
          processes data for the Caisson service lands a row here in the same
          change that introduces it.
        </p>
      </Section>

      {/* ===== Contact ===== */}
      <Section band="surface" eyebrow="Get in touch">
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-5)" }}>
          For a security questionnaire, a data-flow diagram, or a vulnerability
          report, email{" "}
          <a href="mailto:security@caisson.sh" className="cs-link">
            security@caisson.sh
          </a>
          . For contracts, tax, or entity documents, email{" "}
          <a href="mailto:support@caisson.sh" className="cs-link">
            support@caisson.sh
          </a>
          .
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            flexWrap: "wrap",
          }}
        >
          <Button href="/security" variant="primary">
            Security posture
          </Button>
          <Button href="/evidence" variant="ghost">
            The evidence pack
          </Button>
        </div>
      </Section>
    </>
  );
}
