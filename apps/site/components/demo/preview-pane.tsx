import { CodeBlock, StatusChip } from "@/components";

import styles from "./demo.module.css";
import type { DemoPreview } from "./preview-data";

// The shared prebuilt preview pane (ADR-0352): renders T4's real install/build/test/evidence
// transcript of the ONE shared demo app. Labeled honestly as the shared demo app — it is real, but
// it is not the visitor's own artifact (their artifact is the generated tree from the runner above).
// Server component: it just renders the already-parsed data. Absent → the parent hides this section.

export function PreviewPane({ preview }: { preview: DemoPreview }) {
  return (
    <div className={styles.preview}>
      <div className={styles.previewMeta}>
        <span className={styles.resultTitle}>
          {preview.appName} · {preview.bundle} bundle
        </span>
        <span className={styles.resultRunId}>
          built {preview.generatedAt} · {preview.fileManifest.length} files
        </span>
      </div>

      <div className={styles.previewSteps}>
        {preview.steps.map((s) => (
          <CodeBlock
            key={s.label}
            frame
            label={s.command}
            status={
              <StatusChip
                tone={s.ok ? "success" : "muted"}
                dot
                label={s.ok ? "pass" : "fail"}
              />
            }
            code={s.output}
          />
        ))}
      </div>
    </div>
  );
}
