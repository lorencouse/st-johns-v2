"use client";

import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";

/** The studio's "Copy for Squarespace" button, copying the demonstration post. */
export function CopyPostButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // A blocked clipboard leaves the label as it was; nothing else depends on it.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 active:translate-y-px"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <ClipboardCopy className="h-4 w-4" aria-hidden />}
      <span className="truncate">{copied ? "Copied, ready to paste" : "Copy for Squarespace"}</span>
    </button>
  );
}
