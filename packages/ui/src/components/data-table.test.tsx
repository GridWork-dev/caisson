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

const sortableColumns: readonly DataTableColumn<Row>[] = [
  {
    key: "name",
    header: "Name",
    render: (r) => r.name,
    sortable: true,
    sortValue: (r) => r.name,
  },
  {
    key: "credits",
    header: "Credits",
    render: (r) => r.credits,
    numeric: true,
    sortable: true,
    sortValue: (r) => r.credits,
  },
];

const rows3: Row[] = [
  { id: "1", name: "Beta", credits: 300 },
  { id: "2", name: "Acme", credits: 500 },
  { id: "3", name: "Corp", credits: 100 },
];

describe("DataTable — free-line sort/filter/pagination (controlled, server-safe)", () => {
  test("sortable header carries aria-sort and orders rows by sortValue", () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows3}
        rowKey={(r) => r.id}
        sort={{ key: "credits", dir: "asc" }}
      />,
    );
    expect(html).toContain('aria-sort="ascending"');
    // ascending by credits → Corp(100), Beta(300), Acme(500)
    const order = ["Corp", "Beta", "Acme"].map((n) => html.indexOf(n));
    expect(order[0]).toBeLessThan(order[1] as number);
    expect(order[1] as number).toBeLessThan(order[2] as number);
  });

  test("descending inverts the order", () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows3}
        rowKey={(r) => r.id}
        sort={{ key: "credits", dir: "desc" }}
      />,
    );
    expect(html).toContain('aria-sort="descending"');
    const order = ["Acme", "Beta", "Corp"].map((n) => html.indexOf(n));
    expect(order[0]).toBeLessThan(order[1] as number);
    expect(order[1] as number).toBeLessThan(order[2] as number);
  });

  test("filter narrows rows to case-insensitive substring matches", () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows3}
        rowKey={(r) => r.id}
        filterable
        filter="ac"
      />,
    );
    expect(html).toContain('aria-label="Filter rows"');
    expect(html).toContain("Acme");
    expect(html).not.toContain("Beta");
    expect(html).not.toContain("Corp");
  });

  test("pagination slices to the page and renders a pager when >1 page", () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows3}
        rowKey={(r) => r.id}
        pageSize={2}
        page={1}
      />,
    );
    expect(html).toContain("cs-pager");
    // page 1 (0-indexed) of size 2 over 3 rows → the 3rd row only
    expect(html).toContain("Corp");
    expect(html).not.toContain("Acme");
  });

  test("no pager when everything fits one page", () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows3}
        rowKey={(r) => r.id}
        pageSize={10}
      />,
    );
    expect(html).not.toContain("cs-pager");
  });
});
