"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import {
  TimestampedHeading,
  TimestampedParagraph,
} from "./timestamp-extension";

interface TiptapEditorProps {
  content: Record<string, unknown>;
  onUpdate?: (json: Record<string, unknown>, text: string) => void;
  editable?: boolean;
  /** Hands the editor to the parent, for changes made from outside it. */
  onReady?: (editor: Editor | null) => void;
}

export function TiptapEditor({
  content,
  onUpdate,
  editable = true,
  onReady,
}: TiptapEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    // Re-render on cursor moves too, so the toolbar's active state and
    // aria-pressed follow the selection, not just content changes.
    shouldRerenderOnTransaction: true,
    extensions: [
      // StarterKit's own paragraph and heading would strip the timestamp
      // attributes on every edit, so the timestamp-aware versions replace them.
      StarterKit.configure({ paragraph: false, heading: false }),
      TimestampedParagraph,
      TimestampedHeading.configure({ levels: [2, 3] }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class:
          "prose dark:prose-invert prose-base max-w-none focus:outline-none min-h-[200px]",
      },
    },
    onUpdate: ({ editor }) => {
      if (!onUpdate) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(editor.getJSON(), editor.getText());
      }, 1000);
    },
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  // Update content when prop changes (e.g., switching draft versions)
  useEffect(() => {
    if (editor && content) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(content);
      if (currentJson !== newJson) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [editor, content]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-zinc-200 focus-within:ring-2 focus-within:ring-blue-500/40 dark:border-zinc-700">
      {editable && (
        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-1 dark:border-zinc-700">
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            Heading
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            Small heading
          </ToolbarButton>
          <div aria-hidden="true" className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            Bold
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            Italic
          </ToolbarButton>
          <div aria-hidden="true" className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().undo().run()}
          >
            Undo
          </ToolbarButton>
          <ToolbarButton
            active={false}
            onClick={() => editor.chain().focus().redo().run()}
          >
            Redo
          </ToolbarButton>
        </div>
      )}
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}
