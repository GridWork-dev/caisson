import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { IssuanceLog, licenseStatus } from "./issuance-log.tsx";
import type { IssuedLicenseRecord } from "./issuance-log.tsx";

const records: IssuedLicenseRecord[] = [
  {
    licenseId: "11111111-1111-4111-8111-111111111111",
    tier: "pro",
    entitlements: ["compliance", "audit-worm"],
    major: 1,
    expiry: null,
    issuedAt: "2026-07-01T12:00:00.000Z",
  },
  {
    licenseId: "22222222-2222-4222-8222-222222222222",
    tier: "pro",
    entitlements: ["local-ai"],
    major: 1,
    expiry: "2020-01-01T00:00:00.000Z",
    issuedAt: "2019-01-01T00:00:00.000Z",
  },
];

describe("IssuanceLog — SSR render (ADR-0250)", () => {
  test("renders the records + an active/total split", () => {
    const html = renderToStaticMarkup(<IssuanceLog records={records} />);
    expect(html).toContain("Licenses issued");
    expect(html).toContain("Perpetual"); // the null-expiry record
    expect(html).toContain("Active");
    expect(html).toContain("1 lapsed"); // the expired record
  });

  test("empty log renders the empty state", () => {
    const html = renderToStaticMarkup(<IssuanceLog records={[]} />);
    expect(html).toContain("No licenses issued");
  });
});

describe("licenseStatus — perpetual vs. dated", () => {
  const now = Date.parse("2026-07-01T00:00:00.000Z");
  test("null expiry is always active", () => {
    expect(licenseStatus(records[0]!, now)).toBe("active");
  });
  test("past expiry flips to expired", () => {
    expect(licenseStatus(records[1]!, now)).toBe("expired");
  });
  test("future expiry stays active", () => {
    expect(
      licenseStatus(
        { ...records[1]!, expiry: "2099-01-01T00:00:00.000Z" },
        now,
      ),
    ).toBe("active");
  });
});
