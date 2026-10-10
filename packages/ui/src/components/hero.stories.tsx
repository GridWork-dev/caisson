import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import { CredentialStrip } from "./credential-strip";
import { Hero } from "./hero";
import { Terminal } from "./terminal";

const meta = {
  title: "Components/Hero",
  component: Hero,
  tags: ["autodocs"],
  args: {
    eyebrow: "Caisson",
    title: "The compliance wedge under a production-rigor umbrella",
    lede: "One audited base and five module families, with a generator.",
  },
} satisfies Meta<typeof Hero>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCtasAndCredentials: Story = {
  args: {
    ctas: <Button variant="primary">View pricing</Button>,
    credentials: <CredentialStrip items={["SOC 2", "HIPAA", "ISO 27001"]} />,
  },
};

export const WithArtifact: Story = {
  args: {
    ctas: <Button variant="primary">View pricing</Button>,
    artifact: (
      <Terminal label="bun run check">✓ build\n✓ lint\n✓ test</Terminal>
    ),
  },
};
