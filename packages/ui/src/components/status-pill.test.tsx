import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { StatusPill } from "./status-pill";

describe("StatusPill — entitlement status mapping", () => {
  test("active: default label + data-status", () => {
    const html = renderToStaticMarkup(<StatusPill status="active" />);
    expect(html).toContain('data-status="active"');
    expect(html).toContain("Active");
    expect(html).toContain("cs-pill__dot");
  });

  test("expired / revoked / pending: default labels", () => {
    expect(renderToStaticMarkup(<StatusPill status="expired" />)).toContain(
      "Expired",
    );
    expect(renderToStaticMarkup(<StatusPill status="revoked" />)).toContain(
      "Revoked",
    );
    expect(renderToStaticMarkup(<StatusPill status="pending" />)).toContain(
      "Pending",
    );
  });

  test("a children override replaces the default label", () => {
    const html = renderToStaticMarkup(
      <StatusPill status="active">Live</StatusPill>,
    );
    expect(html).toContain("Live");
    expect(html).not.toContain(">Active<");
  });
});
