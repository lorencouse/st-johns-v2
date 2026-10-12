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

  // Edits made before that marker existed: the generator writes the title it
  // chose and a plain text rendered from the blocks, so a difference from
  // either means someone changed the draft. The studio's plain text drops the
  // "## " heading prefix, so any body save of a structured draft shows here.
  if ("generatedTitle" in meta) {
    const generated =
      (meta.generatedTitle as string) || (meta.sourceVideoTitle as string);
    if (generated && draft.title !== generated) {
      return "active draft title was edited";
    }
  }
  if (draft.plainText !== null) {
    const rendered = blocksToPlainText(blocksFromContentJson(draft.contentJson));
    if (collapse(rendered) !== collapse(draft.plainText)) {
      return "active draft body was edited";
    }
  }

  return null;
}
