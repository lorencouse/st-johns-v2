import { describe, expect, mock, test } from "bun:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { BlockControls } from "@/components/library/block-controls";

type ButtonProps = { title: string; onClick: () => void };

function buttons(node: ReactNode): ButtonProps[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<{ children?: ReactNode } & ButtonProps>;
  if (el.type === "button") return [el.props];
  return buttons(el.props.children);
}

describe("transcript block controls", () => {
  test("each control runs its own action and no other", () => {
    const actions = {
      onDelete: mock(() => {}),
      onMarkStart: mock(() => {}),
      onMarkEnd: mock(() => {}),
      onInsertBelow: mock(() => {}),
    };
    const expected: Record<string, keyof typeof actions> = {
      "Delete block": "onDelete",
      "Mark as start": "onMarkStart",
      "Mark as end": "onMarkEnd",
      "Add block below": "onInsertBelow",
    };

    const rendered = buttons(BlockControls({ startMs: 0, ...actions }));
    expect(rendered.map((b) => b.title).sort()).toEqual(Object.keys(expected).sort());

    for (const button of rendered) {
      for (const fn of Object.values(actions)) fn.mockClear();
      button.onClick();
      for (const [name, fn] of Object.entries(actions)) {
        expect(fn).toHaveBeenCalledTimes(name === expected[button.title] ? 1 : 0);
      }
    }
  });
});
