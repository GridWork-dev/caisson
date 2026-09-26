import { CodeBlock, StatusChip } from "@/components";

import styles from "./demo.module.css";
import type { DemoExcerpt } from "./types";

// The read-only commercial-source excerpts (F2 = (d), bundled with the run surface). Full real files
// from T3's append-only, secret-scanned manifest, rendered verbatim via the ADR-0290 CodeBlock
// machinery — never executed, no dynamic import. Server-rendered, no client island. A vertical stack
// (not a reveal-tab set): the manifest is a small, dynamic id set, so per-id CSS reveal rules can't be
// written; stacking 2-3 full files is simpler and count-agnostic, and each frame scrolls internally.
// This surface is NOT gated by the F5 run kill switch — static evidence that stays up when runs pause.

export function ExcerptsSection({
  excerpts,
}: {
  excerpts: readonly DemoExcerpt[];
}) {
  // Graceful empty state — T3's manifest may not have landed yet, or the excerpt flag is off.
  if (excerpts.length === 0) {
    return (
      <p className={styles.emptyNote}>
        The open base is public and readable end to end — generate a project
        above to read it in full.
      </p>
    );
  }

  return (
    <div className={styles.excerpts}>
      {excerpts.map((ex) => (
        <article key={ex.id} className={styles.excerpt}>
          <div className={styles.excerptHead}>
            <h3 className={styles.excerptTitle}>{ex.title}</h3>
            <code className={styles.excerptPath}>{ex.sourcePath}</code>
          </div>
          <CodeBlock
            frame
            label={ex.sourcePath}
            status={
              <StatusChip
                tone="muted"
                label={ex.licensePosture ?? "Apache-2.0"}
              />
            }
            code={ex.content}
          />
        </article>
      ))}
    </div>
  );
}
