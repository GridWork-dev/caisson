import Link from "next/link";

import { Button, Hero, Icon, Reveal, Section } from "@/components";
import { DemoRunner } from "@/components/demo/demo-runner";
import { ExcerptsSection } from "@/components/demo/excerpts-section";
import styles from "@/components/demo/demo.module.css";
import { loadDemoPreview } from "@/components/demo/preview-data";
import { PreviewPane } from "@/components/demo/preview-pane";
// T3 seam: the append-only, secret-scanned excerpt manifest (apps/site/lib/demo-excerpts). Rendered
// read-only; an empty array (manifest not yet landed / flag off) renders the section's graceful state.
// Export name follows the repo's data-array convention (MODULE_PRICES / STACK_AXES); this is the
// single T2↔T3 contract point — if T3 names it otherwise, reconcile here.
import { DEMO_EXCERPTS } from "@/lib/demo-excerpts";
import { breadcrumb, serializeJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Try Caisson — generate a real app",
  description:
    "Generate a real Caisson project in your browser, read the actual commercial source, and watch a real build-and-test transcript of the demo app — before you buy. No install, no signup.",
  path: "/demo",
});

// Two independent flags (ADR-0352 F2): the run path and the excerpts never go dark together. The run
// path's own kill switch/daily-cap lives server-side (503); this public flag only governs excerpt
// visibility so the excerpt evidence can roll back independently of the compute-backed run path.
const EXCERPTS_ENABLED =
  process.env.NEXT_PUBLIC_DEMO_EXCERPTS_ENABLED !== "false";

export default async function DemoPage() {
  const preview = await loadDemoPreview();

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
        title="Prove it runs. Before you pay."
        lede="Generate a real Caisson project right here, read the actual source of the commercial modules, and watch a real build-and-test transcript of the demo app. No install, no signup — the code, not a video."
        ctas={
          <>
            <Button href="#generate" variant="primary">
              Generate an app
            </Button>
            <Button href="#source" variant="ghost">
              Read the source
            </Button>
          </>
        }
      />

      {/* ===== 1. Generate your own app ===== */}
      <Reveal>
        <Section
          id="generate"
          eyebrow="Your own artifact"
          title="Generate a project and read every file."
          lede="Give it a project name and we run the real create-caisson generator server-side, in-process — the same scaffold the CLI emits. The open base comes through as source you own; the commercial modules come through as watermarked stubs, never licensed source. Browse the whole tree below."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <DemoRunner />
          </div>
        </Section>
      </Reveal>

      {/* ===== 2. The shared live preview (T4 artifact) ===== */}
      <Reveal>
        <Section
          band="surface"
          eyebrow="It actually runs"
          title="A real build-and-test transcript of the demo app."
          lede="This is the shared demo app — one project we build through the normal pipeline and capture verbatim: install, build, test, and the evidence walkthrough. It is real output, not the visitor's own artifact, and not a screenshot."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            {preview !== null ? (
              <PreviewPane preview={preview} />
            ) : (
              <p className="cs-muted" style={{ maxWidth: "60ch" }}>
                The shared build transcript is being refreshed. Generate your
                own project above to see the scaffold in the meantime — that
                runs on every visit.
              </p>
            )}
          </div>
        </Section>
      </Reveal>

      {/* ===== 3. Read the real commercial source (T3 excerpts) ===== */}
      {EXCERPTS_ENABLED && (
        <Reveal>
          <Section
            id="source"
            band="tint"
            eyebrow="The real source"
            title="Read the commercial modules, in full."
            lede="Not snippets — whole files from the paid modules, chosen and approved by hand, scanned for anything sensitive before they ship, and shown exactly as they exist in the repo. Read the code that does the work."
          >
            <div style={{ marginTop: "var(--cs-space-6)" }}>
              <ExcerptsSection excerpts={DEMO_EXCERPTS} />
            </div>
          </Section>
        </Reveal>
      )}

      {/* ===== 4. The ladder (F4): sandbox → evaluate on your stack → buy ===== */}
      <Reveal>
        <Section
          eyebrow="What's next"
          title="Three steps, one path — not three competing asks."
          lede="This sandbox is the first rung. When you want a deeper look, run it on your own infrastructure; when it fits, buy the bundle you need."
        >
          <ol
            className={styles.ladder}
            style={{ marginTop: "var(--cs-space-6)" }}
          >
            <LadderRung
              n={1}
              here
              title="Touch it here"
              body="Generate a project and read the real source on this page — zero signup, right now."
            />
            <LadderRung
              n={2}
              title="Run it on your own stack"
              body="Scaffold the audited base with one command and deploy it on your own infrastructure — a real week-one evaluation, with source you own, before you commit."
              cta={{ href: "/stack-fit", label: "Does it fit my stack?" }}
            />
            <LadderRung
              n={3}
              title="Buy the bundle you need"
              body="Committed prices, self-serve checkout — pick a bundle or individual modules and own the source."
              cta={{
                href: "/marketplace?type=bundles",
                label: "See the bundles",
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
