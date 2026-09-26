// "Prove fit in week one" — the trial-path emphasis (research-response wave, ADR-0272 §3). The
// research names integration fit as the objection that kills deals; the neutralizer already ships —
// the create-caisson generator + the Railway/Fly/Vercel deploy templates it emits. This surfaces
// that path at peak purchase intent: on the bundle pages and inside the module/bundle pop-outs.
//
// No eval-license framing (that product is ADR-0274 / Track E2, not built). No future/roadmap
// framing (ADR-0237). Every command is true-to-built: `bunx @caisson-sh/cli@latest my-app` is the
// generator invocation the docs (content/docs/cli/create-caisson.mdx) show verbatim, and
// Railway/Fly/Vercel are the three deploy filesets the generator emits (packages/cli/src/__golden__/
// generated-fileset-deploy-{railway,fly,vercel}.json).
//
// Server-safe (no client hooks) so it renders in the server bundle pages AND the "use client"
// pop-out dialogs unchanged.
import { Button, CodeBlock, Icon } from "@/components";

const SCAFFOLD_CODE = `$ bunx @caisson-sh/cli@latest my-app
$ cd my-app
$ bun install
# ready to run — deploy from the Railway, Fly, or Vercel template`;

export interface TrialPathProps {
  /** Compact form for the module/bundle pop-out dialogs (tighter, no code block). */
  compact?: boolean;
}

/** The trial-path strip: scaffold the audited base and deploy it on your own stack.
 *  `compact` renders the dialog-sized form; the default renders the full page form. */
export function TrialPath({ compact = false }: TrialPathProps) {
  if (compact) {
    return (
      <div
        style={{
          border: "1px solid var(--cs-border)",
          borderRadius: "var(--cs-radius-md)",
          padding: "var(--cs-space-4)",
          display: "grid",
          gap: "var(--cs-space-2)",
        }}
      >
        <div className="cs-status" style={{ fontSize: "var(--cs-text-sm)" }}>
          <Icon name="terminal" />
          Prove fit in week one
        </div>
        <p
          className="cs-muted"
          style={{
            margin: 0,
            fontSize: "var(--cs-text-xs)",
            lineHeight: "var(--cs-leading-snug)",
          }}
        >
          Scaffold the audited base with{" "}
          <code className="mono">bunx @caisson-sh/cli@latest my-app</code>, then
          deploy from the Railway, Fly, or Vercel template the generator emits —
          running on your own stack, with source you own.
        </p>
        <Button
          href="/docs/cli/create-caisson"
          variant="ghost"
          style={{ justifySelf: "start" }}
        >
          How the generator works &rarr;
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{ display: "grid", gap: "var(--cs-space-5)", maxWidth: "44rem" }}
    >
      <p className="cs-muted" style={{ maxWidth: "60ch" }}>
        The first question is whether it fits the stack you already run. Answer
        it with code: scaffold the audited base in one command and deploy from
        the template the generator emits for your host. You own the source from
        the first line, so a week-one spike is a real evaluation on your own
        infrastructure — not a demo that disappears.
      </p>
      <CodeBlock frame label="scaffold and deploy" code={SCAFFOLD_CODE} />
      <div className="cs-cta-row">
        <Button href="/docs/cli/create-caisson" variant="primary">
          How the generator works
        </Button>
      </div>
    </div>
  );
}
