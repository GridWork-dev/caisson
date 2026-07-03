"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics";

/** Fires one `view_item` per mount (ADR-0237 F8) — dropped onto module/edition depth pages,
 *  which are RSCs and can't call the tracker themselves. Renders nothing. */
export function TrackView({ item }: { item: string }) {
  useEffect(() => {
    trackEvent("view_item", { item });
  }, [item]);
  return null;
}
