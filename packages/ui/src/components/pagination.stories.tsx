import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Pagination, type PaginationProps } from "./pagination";

/** Pagination is controlled (`page` + `onPageChange`), so every story owns its own page state. */
function PaginationDemo(props: Omit<PaginationProps, "page" | "onPageChange">) {
  const [page, setPage] = useState(0);
  return <Pagination {...props} page={page} onPageChange={setPage} />;
}

const meta = {
  title: "Components/Pagination",
  component: PaginationDemo,
  tags: ["autodocs"],
  args: {
    pageCount: 12,
  },
} satisfies Meta<typeof PaginationDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FewPages: Story = {
  args: { pageCount: 3 },
};
