import { describe, expect, test } from "bun:test";
import { can } from "./permissions";

describe("can", () => {
  test.each([
    ["owner", "edit", true],
    ["admin", "edit", true],
    ["editor", "edit", true],
    ["reviewer", "edit", false],
    ["viewer", "edit", false],
    ["owner", "review", true],
    ["admin", "review", true],
    ["editor", "review", false],
    ["reviewer", "review", true],
    ["viewer", "review", false],
    ["owner", "admin", true],
    ["admin", "admin", true],
    ["editor", "admin", false],
    ["reviewer", "admin", false],
    ["viewer", "admin", false],
  ] as const)("%s %s is %s", (role, permission, allowed) => {
    expect(can(role, permission)).toBe(allowed);
  });

  test("an unknown role can do nothing", () => {
    expect(can("guest", "edit")).toBe(false);
  });
});
