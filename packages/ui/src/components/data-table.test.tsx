import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DataTable, type DataTableColumn } from "./data-table";

interface Row {
  id: string;
  name: string;
  credits: number;
}

const columns: readonly DataTableColumn<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
  {
    key: "credits",
    header: "Credits",
    render: (r) => r.credits,
    numeric: true,
  },
];

describe("DataTable — empty vs rows vs loading", () => {
  test("renders rows with right-aligned numeric columns", () => {
    const rows: Row[] = [{ id: "1", name: "Acme", credits: 500 }];
    const html = renderToStaticMarkup(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />,
    );
    expect(html).toContain("Acme");
    expect(html).toContain("500");
    expect(html).toContain('data-numeric=""');
    expect(html).not.toContain("cs-empty");
    expect(html).not.toContain("cs-skeleton");
  });

  test("renders the default EmptyState when rows is empty", () => {
    const html = renderToStaticMarkup(
      <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} />,
    );
    expect(html).toContain("cs-empty");
    expect(html).toContain("No rows yet");
  });

  test("renders a custom empty node when given", () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        empty={<p>Nothing to show</p>}
      />,
    );
    expect(html).toContain("Nothing to show");
    expect(html).not.toContain("cs-empty");
  });

  test("renders LoadingState (table variant) instead of rows/empty when loading", () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        loading
        loadingRows={2}
      />,
    );
    expect(html).toContain("cs-skeleton");
    expect(html).toContain('data-variant="table"');
    expect(html).not.toContain("cs-empty");
  });

  test("loading takes precedence even when rows are present", () => {
    const rows: Row[] = [{ id: "1", name: "Acme", credits: 500 }];
    const html = renderToStaticMarkup(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} loading />,
    );
    expect(html).toContain("cs-skeleton");
    expect(html).not.toContain("Acme");
  });
});
