import { Button } from "./button";

/** A gallery entry's two destinations: its docs page and its live demo. The demo lives in the
 *  separate `/demos` static export, so it is a hard navigation (plain `<a>`), never next/link. */
export function EntryLinks({
  label,
  docsHref,
  demoHref,
}: {
  label: string;
  docsHref: string | undefined;
  demoHref: string | null;
}) {
  if (!docsHref && !demoHref) return null;
  return (
    <div className="cs-cta-row">
      {docsHref ? (
        <Button href={docsHref} variant="ghost" aria-label={`${label} docs`}>
          Docs
        </Button>
      ) : null}
      {demoHref ? (
        <Button
          href={demoHref}
          hard
          variant="primary"
          aria-label={`${label} live demo`}
        >
          Live demo
        </Button>
      ) : null}
    </div>
  );
}
