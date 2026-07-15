import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataTable, type DataTableColumn } from "./data-table";

interface SeatRow {
  id: string;
  org: string;
  seats: number;
  tier: string;
}

const ROWS: SeatRow[] = [
  { id: "1", org: "Northwind Freight", seats: 12, tier: "Compliance" },
  { id: "2", org: "Aperture Labs", seats: 4, tier: "Everything" },
  { id: "3", org: "Globex", seats: 28, tier: "Agentic-Dev" },
];

const COLUMNS: DataTableColumn<SeatRow>[] = [
  {
    key: "org",
    header: "Organization",
    render: (r) => r.org,
    sortable: true,
    sortValue: (r) => r.org,
  },
  {
    key: "seats",
    header: "Seats",
    render: (r) => r.seats,
    numeric: true,
    sortable: true,
    sortValue: (r) => r.seats,
  },
  { key: "tier", header: "Bundle", render: (r) => r.tier },
];

const meta = {
  title: "Components/DataTable",
  component: DataTable<SeatRow>,
  tags: ["autodocs"],
  args: {
    columns: COLUMNS,
    rows: ROWS,
    rowKey: (r: SeatRow) => r.id,
  },
} satisfies Meta<typeof DataTable<SeatRow>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: { loading: true, loadingRows: 3 },
};

export const Empty: Story = {
  args: { rows: [] },
};

export const Filterable: Story = {
  args: { filterable: true, filterPlaceholder: "Search organizations…" },
};
