import { describe, expect, test } from "bun:test";
import {
  ORG_CONTROLS_ENTITLEMENT_ID,
  ORG_CONTROLS_MODULE_ID,
  holdsOrgControls,
} from "./index.ts";

describe("holdsOrgControls — fail-closed entitlement predicate", () => {
  test("DENY: empty set", () => {
    expect(holdsOrgControls([])).toBe(false);
  });

  test("DENY: other entitlements only", () => {
    expect(holdsOrgControls(["compliance", "field-crypto", "everything"])).toBe(
      false,
    );
  });

  test("ALLOW: bare-slug grant", () => {
    expect(holdsOrgControls([ORG_CONTROLS_ENTITLEMENT_ID])).toBe(true);
    expect(holdsOrgControls(["compliance", "org-controls"])).toBe(true);
  });

  test("ALLOW: full module-id grant", () => {
    expect(holdsOrgControls([ORG_CONTROLS_MODULE_ID])).toBe(true);
  });

  test("DENY: a near-miss id does not match", () => {
    expect(
      holdsOrgControls(["org-control", "org-controls-x", "controls"]),
    ).toBe(false);
  });
});
