import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MatrixViewer, buildMatrix } from "./matrix-viewer.tsx";
import type { Finding } from "../findings.ts";
import type { CoverageRow } from "../coverage.ts";

const findings: Finding[] = [
  {
    id: "f1",
    domain: "packages/kernel",
    dimension: "D1",
    subject: "src/audit-chain.ts",
    title: "unbounded loop",
    severity: "high",
    status: "open",
  },
  {
    id: "f2",
    domain: "apps/admin",
    dimension: "D3",
    subject: "copy",
    title: "gridwork-ism in README",
    severity: "info",
    status: "fixed",
  },
];

const coverage: CoverageRow[] = [
  {
    round: 1,
    domain: "packages/kernel",
    dimension: "D1",
    filesScanned: 3,
    findings: 1,
    executed: true,
  },
  {
    round: 2,
    domain: "packages/kernel",
    dimension: "D1",
    filesScanned: 3,
    findings: 1,
    executed: true,
  },
  {
    round: 1,
    domain: "apps/admin",
    dimension: "D3",
    filesScanned: 5,
    findings: 0,
    executed: false,
  },
];

describe("buildMatrix — latest-round pivot", () => {
  test("keeps the highest round per (domain × dimension) cell", () => {
    const rows = buildMatrix(coverage);
    const kernel = rows.find((r) => r.domain === "packages/kernel")!;
    expect(kernel.cells["D1"]).toEqual({ executed: true, findings: 1 });
    const admin = rows.find((r) => r.domain === "apps/admin")!;
    expect(admin.cells["D3"]).toEqual({ executed: false, findings: 0 });
  });
  test("no coverage folds to no rows", () => {
    expect(buildMatrix([])).toEqual([]);
  });
});

describe("MatrixViewer — SSR render (ADR-0250)", () => {
  test("renders the matrix + findings + open/high headline", () => {
    const html = renderToStaticMarkup(
      <MatrixViewer findings={findings} coverage={coverage} />,
    );
    expect(html).toContain("packages/kernel");
    expect(html).toContain("High severity");
    expect(html).toContain("unbounded loop");
    expect(html).toContain("high"); // severity chip label
  });

  test("without coverage, only the findings table shows (no matrix crash)", () => {
    const html = renderToStaticMarkup(<MatrixViewer findings={findings} />);
    expect(html).toContain("unbounded loop");
    expect(html).not.toContain("No coverage recorded");
  });

  test("empty findings renders the clean-ledger empty state", () => {
    const html = renderToStaticMarkup(<MatrixViewer findings={[]} />);
    expect(html).toContain("No findings");
  });
});
