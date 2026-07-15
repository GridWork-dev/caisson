import type { Meta, StoryObj } from "@storybook/react-vite";

import { CredentialStrip } from "./credential-strip";

const meta = {
  title: "Components/CredentialStrip",
  component: CredentialStrip,
  tags: ["autodocs"],
  args: {
    items: ["SOC 2", "HIPAA", "ISO 27001", "FedRAMP-ready"],
  },
} satisfies Meta<typeof CredentialStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithNote: Story = {
  args: { note: "Audit reports available under NDA." },
};
