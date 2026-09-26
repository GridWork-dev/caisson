import Link from "next/link";

import { Button, Hero, Icon, Reveal, Section } from "@/components";
import { ExcerptsSection } from "@/components/demo/excerpts-section";
import styles from "@/components/demo/demo.module.css";
// T3 seam: the append-only, secret-scanned excerpt manifest (apps/site/lib/demo-excerpts). Rendered
// read-only; an empty array (manifest not yet landed / flag off) renders the section's graceful state.
// Export name follows the repo's data-array convention (MODULES / STACK_AXES); this is the
// single T2↔T3 contract point — T3 landed the manifest at demo-excerpts/manifest.ts (the dir also
// holds the tools/ scanner's peer types), so this reconciles to the file, not a dir barrel.
import { DEMO_EXCERPTS } from "@/lib/demo-excerpts/manifest";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Try Caisson — read the real source",
  description:
    "Read the actual module source, whole files as they exist in the repo. No install, no signup.",
  path: "/demo",
});

// The public flag governs excerpt visibility so the excerpt evidence can roll back on its own
// (ADR-0352 F2).
const EXCERPTS_ENABLED =
  process.env.NEXT_PUBLIC_DEMO_EXCERPTS_ENABLED !== "false";

export default function DemoPage() {
  const ldBreadcrumb = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Try it", path: "/demo" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldBreadcrumb) }}
      />

      <Hero
        eyebrow="Try it"
        title="Prove it runs."
        lede="Read the actual source of the modules. No install, no signup — the code, not a video."
        ctas={
          <>
            <Button href="#source" variant="primary">
              Read the source
            </Button>
            <Button href="/marketplace" variant="ghost">
              Run the live demos
            </Button>
          </>
        }
      />

      {/* ===== 1. Read the real source (T3 excerpts) ===== */}
      {EXCERPTS_ENABLED && (
        <Reveal>
          <Section
            id="source"
            band="tint"
            eyebrow="The real source"
            title="Read the modules, in full."
            lede="Not snippets — whole files from the modules, chosen by hand, scanned for anything sensitive before they ship, and shown exactly as they exist in the repo. Read the code that does the work."
          >
            <div style={{ marginTop: "var(--cs-space-6)" }}>
              <ExcerptsSection excerpts={DEMO_EXCERPTS} />
            </div>
          </Section>
        </Reveal>
      )}

      {/* ===== 2. The ladder (F4): read here → run the demos → run it on your stack ===== */}
      <Reveal>
        <Section
          eyebrow="What's next"
          title="Three steps, one path — not three competing asks."
          lede="This page is the first rung. Then drive each module's live demo, and run the base on your own infrastructure."
        >
          <ol
            className={styles.ladder}
            style={{ marginTop: "var(--cs-space-6)" }}
          >
            <LadderRung
              n={1}
              here
              title="Touch it here"
              body="Read the real source on this page — zero signup, right now."
            />
            <LadderRung
              n={2}
              title="Drive the live demos"
              body="Every module family has an in-browser demo that runs the module's own code: tamper with it and watch it fail closed."
              cta={{ href: "/marketplace", label: "Open the marketplace" }}
            />
            <LadderRung
              n={3}
              title="Run it on your own stack"
              body="Scaffold the audited base with one command and deploy it on your own infrastructure — a real week-one evaluation, with source you own."
              cta={{
                href: "/docs/cli/create-caisson",
                label: "How the generator works",
              }}
            />
          </ol>
        </Section>
      </Reveal>
    </>
  );
}

function LadderRung({
  n,
  title,
  body,
  cta,
  here = false,
}: {
  n: number;
  title: string;
  body: string;
  cta?: { href: string; label: string };
  here?: boolean;
}) {
  return (
    <li className={styles.ladderRung}>
      <span className={styles.ladderNum} aria-hidden="true">
        {n}
      </span>
      <div>
        <p className={styles.ladderTitle}>
          {title}
          {here ? (
            <span className={styles.ladderHere}> — you&apos;re here</span>
          ) : null}
        </p>
        <p className="cs-muted" style={{ maxWidth: "58ch" }}>
          {body}
        </p>
        {cta ? (
          <Link href={cta.href} className="cs-link">
            {cta.label} <Icon name="arrow" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}
