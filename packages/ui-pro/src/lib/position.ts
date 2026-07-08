// Hand-rolled floating-panel positioning (ADR-0291): the minimal subset of what a library like
// @floating-ui computes — anchor a panel to a trigger rect on a preferred side, flip to the
// opposite side if it would overflow the viewport, then clamp on the cross axis so the panel never
// renders off-screen. Zero dependencies; pure function, easy to unit test without a real DOM.

export type Placement = "top" | "bottom" | "left" | "right";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface FloatingPosition {
  top: number;
  left: number;
  /** The placement actually used, after any flip. */
  placement: Placement;
}

const OPPOSITE: Record<Placement, Placement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function fits(
  placement: Placement,
  trigger: Rect,
  panel: Size,
  viewport: Size,
  gap: number,
): boolean {
  if (placement === "bottom")
    return trigger.top + trigger.height + gap + panel.height <= viewport.height;
  if (placement === "top") return trigger.top - gap - panel.height >= 0;
  if (placement === "right")
    return trigger.left + trigger.width + gap + panel.width <= viewport.width;
  return trigger.left - gap - panel.width >= 0; // "left"
}

function place(
  placement: Placement,
  trigger: Rect,
  panel: Size,
  gap: number,
): { top: number; left: number } {
  switch (placement) {
    case "bottom":
      return { top: trigger.top + trigger.height + gap, left: trigger.left };
    case "top":
      return { top: trigger.top - panel.height - gap, left: trigger.left };
    case "right":
      return { top: trigger.top, left: trigger.left + trigger.width + gap };
    case "left":
      return { top: trigger.top, left: trigger.left - panel.width - gap };
  }
}

/**
 * Computes a viewport-relative `{top, left}` (paired with `position: fixed`, matching
 * `getBoundingClientRect`'s coordinate space) for a panel anchored to `trigger` on the
 * `preferred` side. Flips to the opposite side if the preferred side would overflow the viewport
 * and the opposite side fits better; otherwise clamps on the cross axis so the panel stays fully
 * on-screen (never returns coordinates that clip it).
 */
export function computeFloatingPosition(
  trigger: Rect,
  panel: Size,
  viewport: Size,
  preferred: Placement = "bottom",
  gap = 8,
): FloatingPosition {
  const placement = fits(preferred, trigger, panel, viewport, gap)
    ? preferred
    : fits(OPPOSITE[preferred], trigger, panel, viewport, gap)
      ? OPPOSITE[preferred]
      : preferred;

  const { top, left } = place(placement, trigger, panel, gap);
  const isVertical = placement === "top" || placement === "bottom";

  const clampedLeft = isVertical
    ? Math.min(
        Math.max(left, gap),
        Math.max(gap, viewport.width - panel.width - gap),
      )
    : left;
  const clampedTop = isVertical
    ? top
    : Math.min(
        Math.max(top, gap),
        Math.max(gap, viewport.height - panel.height - gap),
      );

  return { top: clampedTop, left: clampedLeft, placement };
}
