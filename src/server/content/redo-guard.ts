import { blocksFromContentJson, blocksToPlainText } from "./document";

/**
 * Whether a regeneration may replace a project's active draft.
 *
 * A `generate-drafts --redo` batch rolls out pipeline fixes across every post,
 * so without this check it would swap a reviewed or hand-edited post for an
 * unreviewed AI version. The edits would survive in an older draft row but
 * vanish from the studio and from exports.
 */

export interface GuardProject {
  status: string;
}

export interface GuardDraft {
  status: string;
  title: string;
  plainText: string | null;
  contentJson: unknown;
  metadataJson: unknown;
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Returns why the active draft must be kept, or null when a redo may replace
 * it. A project with no active draft is never protected.
 */
export function redoBlockReason(
  project: GuardProject,
  draft: GuardDraft | null
): string | null {
  // Anything past drafting has been put in front of a reviewer.
  if (project.status !== "drafting") return `project is ${project.status}`;
  if (!draft) return null;
  if (draft.status !== "working") return `active draft is ${draft.status}`;

  const meta = (draft.metadataJson ?? {}) as Record<string, unknown>;

  // Set by the studio autosave on every edit.
  if (meta.humanEditedAt) return "active draft was edited in the studio";

  // Drafts from before section headings record no generated title, and an
  // editor's body save of a heading-less draft leaves its plain text as the
  // generator wrote it, so an edit to one cannot be told apart from none.
  if (!("generatedTitle" in meta)) {
    return "legacy draft may have been edited before edits were recorded";
  }

  // Edits made before that marker existed: the generator writes the title it
  // chose and a plain text rendered from the blocks, so a difference from
  // either means someone changed the draft. The studio's plain text drops the
  // "## " heading prefix, so any body save of a structured draft shows here.
  const generated =
    (meta.generatedTitle as string) || (meta.sourceVideoTitle as string);
  if (generated && draft.title !== generated) {
    return "active draft title was edited";
  }
  if (draft.plainText !== null) {
    const rendered = blocksToPlainText(blocksFromContentJson(draft.contentJson));
    if (collapse(rendered) !== collapse(draft.plainText)) {
      return "active draft body was edited";
    }
  }

  return null;
}

/**
 * A Tiptap node in a canonical form: the editor adds a null `time` label to
 * nodes the generator wrote without one, and drops empty `content` arrays, so
 * neither counts as a change.
 */
function canonical(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(canonical);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(node).sort()) {
    let value = (node as Record<string, unknown>)[key];
    if (key === "attrs" && value && typeof value === "object") {
      const attrs = Object.fromEntries(
        Object.entries(value).filter(([, v]) => v !== null && v !== undefined)
      );
      value = Object.keys(attrs).length ? canonical(attrs) : undefined;
    } else if (key === "content" && Array.isArray(value) && !value.length) {
      value = undefined;
    } else {
      value = canonical(value);
    }
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export interface DraftFields {
  title?: string | null;
  intro?: string | null;
  summary?: string | null;
  contentJson?: unknown;
}

/**
 * Whether a studio save changes what a person reads. Opening a draft makes
 * the editor save its own normalized copy of the body, which must not count
 * as an edit. Plain text is derived from the body, so it is not compared.
 */
export function savesAnEdit(stored: DraftFields, incoming: DraftFields): boolean {
  for (const key of ["title", "intro", "summary"] as const) {
    if (incoming[key] !== undefined && (incoming[key] ?? "") !== (stored[key] ?? "")) {
      return true;
    }
  }
  return (
    incoming.contentJson !== undefined &&
    JSON.stringify(canonical(incoming.contentJson)) !==
      JSON.stringify(canonical(stored.contentJson))
  );
}
