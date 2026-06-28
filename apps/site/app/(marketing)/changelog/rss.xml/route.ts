// RSS 2.0 feed for the Caisson changelog — force-static so it emits at build time.
// Content-Type: application/xml. Entries are shared with the /changelog page via
// lib/changelog.ts — add an entry there and it appears in both surfaces.
export const dynamic = "force-static";

import { NextResponse } from "next/server";
import {
  CHANGELOG_ENTRIES,
  FEED_DESCRIPTION,
  FEED_RSS_URL,
  FEED_TITLE,
  FEED_URL,
} from "@/lib/changelog";

/** Escape the five XML predefined entities so no entry body can break out of a CDATA-less field. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET(): NextResponse {
  const items = CHANGELOG_ENTRIES.map((entry) => {
    const link = `${FEED_URL}#${entry.slug}`;
    // pubDate in RFC 822 / RSS 2.0 format.
    // The date string is YYYY-MM-DD in UTC; append T00:00:00Z to avoid local-tz shifts.
    const pubDate = new Date(`${entry.date}T00:00:00Z`).toUTCString();
    return `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(entry.body)}</description>
    </item>`;
  }).join("\n");

  const lastBuildDate = (() => {
    const first = CHANGELOG_ENTRIES[0];
    if (!first) return new Date().toUTCString();
    return new Date(`${first.date}T00:00:00Z`).toUTCString();
  })();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${FEED_URL}</link>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${FEED_RSS_URL}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
