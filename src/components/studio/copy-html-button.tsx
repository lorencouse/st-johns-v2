"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Code2, Loader2 } from "lucide-react";
import { writeRichHtml, htmlToPlainText } from "@/lib/clipboard";

interface CopyHtmlButtonProps {
  workspaceId: string;
  projectId: string;
}

type Mode = "formatted" | "source";

export function CopyHtmlButton({
  workspaceId,
  projectId,
}: CopyHtmlButtonProps) {
  const [busy, setBusy] = useState<Mode | null>(null);
  const [copied, setCopied] = useState<Mode | null>(null);
  const [error, setError] = useState("");

  async function handleCopy(mode: Mode) {
    setBusy(mode);
    setError("");
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/render?embed=${
          mode === "formatted" ? "link" : "iframe"
        }`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not build the post");
        return;
      }
      const { html } = (await res.json()) as { html: string };

      if (mode === "formatted") {
        await writeRichHtml(html, htmlToPlainText(html));
      } else {
        await navigator.clipboard.writeText(html);
      }

      setCopied(mode);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setError("Copying failed — your browser blocked clipboard access");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => handleCopy("formatted")}
        disabled={busy !== null}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy === "formatted" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : copied === "formatted" ? (
          <Check className="h-4 w-4" />
        ) : (
          <ClipboardCopy className="h-4 w-4" />
        )}
        {copied === "formatted" ? "Copied — ready to paste" : "Copy for Squarespace"}
      </button>

      <button
        onClick={() => handleCopy("source")}
        disabled={busy !== null}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {busy === "source" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : copied === "source" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Code2 className="h-3.5 w-3.5" />
        )}
        {copied === "source" ? "HTML copied" : "Copy raw HTML (Code Block)"}
      </button>

      {copied === "formatted" && (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          In Squarespace: add a <strong>Text</strong> block and press
          {" "}
          <kbd className="rounded border border-zinc-300 px-1 dark:border-zinc-600">
            ⌘V
          </kbd>
          . Headings, paragraphs and timestamp links come across formatted. Add
          the sermon video with Squarespace&apos;s own <strong>Video</strong>{" "}
          block — pasted embeds get stripped.
        </p>
      )}

      {copied === "source" && (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          Paste into a Squarespace <strong>Code</strong> block. This version
          keeps the embedded video player.
        </p>
      )}

      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
