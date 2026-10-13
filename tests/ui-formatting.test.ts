import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guards the "buttons are one line" rule from AGENTS.md. Real <button>s get it
// from the base layer in globals.css; links and pills styled as buttons do not,
// so they have to carry `whitespace-nowrap` (or `truncate`) themselves.

const root = join(import.meta.dir, "..");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("one-line buttons", () => {
  test("the base layer keeps button labels on one line", () => {
    const base = css.slice(css.indexOf("@layer base"));
    const rule = base.match(/button,[^{]*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain("white-space: nowrap");
    expect(rule![1]).toContain("text-overflow: ellipsis");
  });

  test("links and pills styled as buttons do not wrap", () => {
    const offenders: string[] = [];
    // An opening <Link>, <a> or <span> tag and the static part of its className.
    const tag = /<(Link|a|span)\b[^>]*?className=\{?[`"]([^`"]*)/g;
    for (const file of sourceFiles(join(root, "src"))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(tag)) {
        const classes = match[2].split(/\s+/);
        const pill = classes.includes("rounded-full") && classes.some((c) => /^px-/.test(c));
        const buttonLike =
          classes.some((c) => /^rounded(-|$)/.test(c)) &&
          classes.some((c) => /^px-/.test(c)) &&
          classes.some((c) => /^bg-(?!transparent)/.test(c));
        if (!pill && !buttonLike) continue;
        if (classes.includes("whitespace-nowrap") || classes.includes("truncate")) continue;
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${file.slice(root.length + 1)}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
