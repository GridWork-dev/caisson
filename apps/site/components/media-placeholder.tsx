// The one media-slot placeholder (ADR-0237 F2, simplified per operator directive): the page's
// mark at low opacity on a --cs-surface-2 field over a hairline grid. Shared by the renderer's
// `media` section arm and the hand-authored edition pages; the aspect-ratio container is the one
// contract real media later drops into. Decorative — hidden from the a11y tree.
import { Icon, type IconName } from "@caisson-sh/ui/components";

export interface MediaPlaceholderProps {
  /** The mark rendered as placeholder art (decorative). */
  icon?: IconName;
  /** CSS aspect-ratio of the container, e.g. "16 / 9" (default). The one contract. */
  aspect?: string;
}

export function MediaPlaceholder({ icon, aspect }: MediaPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        aspectRatio: aspect ?? "16 / 9",
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--cs-radius-lg)",
        border: "1px solid var(--cs-border)",
        background:
          "repeating-linear-gradient(0deg, transparent 0 31px, var(--cs-border) 31px 32px), repeating-linear-gradient(90deg, transparent 0 31px, var(--cs-border) 31px 32px), var(--cs-surface-2)",
        overflow: "hidden",
      }}
    >
      {icon && (
        <span style={{ opacity: 0.18, transform: "scale(6)" }}>
          <Icon name={icon} size="lg" />
        </span>
      )}
    </div>
  );
}
