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

  test("the blind path relabels its badge 'Link only' — never a bare 'Verified' (honesty, T-U4)", () => {
    const html = renderToStaticMarkup(<AuditTimeline entries={entries} />);
    expect(html).toContain("Link only");
    expect(html).not.toContain(">Verified<");
  });

  test("anchor-derived statuses override the blind check: a link-fine row can read tampered", () => {
    // The blind check would call entry 1 'verified' (its prevHash matches). The anchor-derived status
    // says tampered — that must win (closing the anchor-blindness gap).
    const html = renderToStaticMarkup(
      <AuditTimeline
        entries={entries}
        statuses={["genesis", "tampered", "unverifiable"]}
      />,
    );
    expect(html).toContain('data-status="tampered"');
    expect(html).toContain('data-status="unverifiable"');
    expect(html).toContain("Tampered");
    expect(html).not.toContain("Link only");
  });
});
