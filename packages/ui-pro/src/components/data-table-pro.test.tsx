import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DataTablePro, type DataTableProColumn } from "./data-table-pro";

interface Row {
  team: string;
  seats: number;
}

const columns: readonly DataTableProColumn<Row>[] = [
  {
    key: "team",
    header: "Team",
    render: (r) => r.team,
    value: (r) => r.team,
    sortable: true,
    filterable: true,
    groupable: true,
    exportHeader: "Team",
  },
  {
    key: "seats",
    header: "Seats",
    render: (r) => r.seats,
    numeric: true,
    value: (r) => r.seats,
    sortable: true,
    aggregate: "sum",
    exportHeader: "Seats",
  },
];

const rows: Row[] = [
  { team: "Acme", seats: 12 },
  { team: "Beta", seats: 3 },
];

describe("DataTablePro (initial render)", () => {
  test("renders a sortable, filterable grid with all rows and a status line", () => {
    const html = renderToStaticMarkup(
      <DataTablePro
        columns={columns}
        rows={rows}
        rowKey={(r) => r.team}
        exportFileName="teams.csv"
      />,
    );
    // headers + sort affordance
    expect(html).toContain("Team");
    expect(html).toContain("Seats");
    expect(html).toContain('aria-sort="none"');
    expect(html).toContain("cs-grid__sort");
    // filter builder present (labelled controls)
    expect(html).toContain('aria-label="Filter column"');
    expect(html).toContain('aria-label="Filter operator"');
    expect(html).toContain('aria-label="Filter value"');
    // group + columns + export controls
    expect(html).toContain('aria-label="Group by column"');
    expect(html).toContain("Columns");
    expect(html).toContain("Export CSV");
    // rows render
    expect(html).toContain("Acme");
    expect(html).toContain("Beta");
    // status reflects total
    expect(html).toContain('role="status"');
    expect(html).toContain("2 of 2 rows");
  });

  test("no export button unless exportFileName is set", () => {
    const html = renderToStaticMarkup(
      <DataTablePro columns={columns} rows={rows} rowKey={(r) => r.team} />,
    );
    expect(html).not.toContain("Export CSV");
  });

  test("virtualized mode caps the scroll viewport", () => {
    const html = renderToStaticMarkup(
      <DataTablePro
        columns={columns}
        rows={rows}
        rowKey={(r) => r.team}
        rowHeight={40}
        viewportHeight={200}
      />,
    );
    expect(html).toContain("max-height:200px");
  });
});
