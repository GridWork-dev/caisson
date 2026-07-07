import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AuditTimeline, shortHash, type AuditEntry } from "./audit-timeline";

const entries: AuditEntry[] = [
  {
    id: "1",
    timestamp: "2026-07-07T00:00:00Z",
    action: "Created",
    hash: "aaaa",
  },
  {
    id: "2",
    timestamp: "2026-07-07T00:01:00Z",
    action: "Revoked",
    actor: "admin",
    hash: "bbbb",
    prevHash: "aaaa",
  },
  {
    id: "3",
    timestamp: "2026-07-07T00:02:00Z",
    action: "Edited",
    hash: "cccc",
    prevHash: "WRONG",
  },
];

describe("shortHash", () => {
  test("elides the middle of a long hash, leaves a short one alone", () => {
    expect(shortHash("short")).toBe("short");
    expect(shortHash("0123456789abcdef0123456789")).toBe("0123456789…456789");
  });
});

describe("AuditTimeline", () => {
  test("renders an ordered log with per-link verification badges", () => {
    const html = renderToStaticMarkup(<AuditTimeline entries={entries} />);
    expect(html).toContain("<ol");
    expect(html).toContain('aria-label="Audit timeline"');
    expect(html).toContain('data-status="genesis"');
    expect(html).toContain('data-status="verified"');
    expect(html).toContain('data-status="broken"');
    expect(html).toContain('aria-label="Broken link — tamper evidence"');
    expect(html).toContain("Revoked");
    expect(html).toContain("admin");
  });

  test("verifyLinks=false shows the log with no badges", () => {
    const html = renderToStaticMarkup(
      <AuditTimeline entries={entries} verifyLinks={false} />,
    );
    expect(html).not.toContain("cs-timeline__badge");
    expect(html).toContain("Created");
  });
});
