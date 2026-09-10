import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";

/**
 * Timestamps are node attributes, not text.
 *
 * Keeping them out of the editable text means an editor can retitle a section
 * or rewrite a paragraph without breaking the link back into the video, and
 * can never half-delete a "[12:34]" into nonsense. StarterKit's stock Paragraph
 * and Heading drop attributes they don't declare, so both are re-registered
 * here with the two we persist: `timestamp` (seconds, the source of truth for
 * export links) and `time` (the pre-formatted label the stylesheet renders).
 */
const timestampAttributes = {
  timestamp: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) => {
      const raw = element.getAttribute("data-timestamp");
      if (raw === null) return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    },
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.timestamp === null || attrs.timestamp === undefined
        ? {}
        : { "data-timestamp": String(attrs.timestamp) },
  },
  time: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.getAttribute("data-time"),
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.time ? { "data-time": String(attrs.time) } : {},
  },
};

export const TimestampedParagraph = Paragraph.extend({
  addAttributes() {
    return { ...this.parent?.(), ...timestampAttributes };
  },
});

export const TimestampedHeading = Heading.extend({
  addAttributes() {
    return { ...this.parent?.(), ...timestampAttributes };
  },
});
