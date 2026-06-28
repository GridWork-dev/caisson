import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Web app manifest (ADR-0079 §4). theme-color + the waterline glyph close the bare-default-favicon
// gap. color_scheme is dark-first (the site's locked default theme).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caisson — Compliance-grade infrastructure",
    short_name: "Caisson",
    description: "Compliance-grade infrastructure for regulated SaaS.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1216",
    theme_color: "#0d1216",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
