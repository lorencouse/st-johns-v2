"use client";

import { useState, useEffect } from "react";
import { copyArtifactToClipboard } from "@/lib/clipboard";

interface ExportArtifact {
  id: string;
  format: string;
  fileName: string;
  mimeType: string;
  bodyText: string | null;
  createdAt: string;
}

interface ExportPanelProps {
  workspaceId: string;
  projectId: string;
}

export function ExportPanel({ workspaceId, projectId }: ExportPanelProps) {
  const [artifacts, setArtifacts] = useState<ExportArtifact[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/exports`
        );
        if (!res.ok || !isActive) return;

        const data = await res.json();
        if (isActive) {
          setArtifacts(data.artifacts);
        }
      } catch {
        // Silent fail
      }
    })();

    return () => {
      isActive = false;
    };
  }, [workspaceId, projectId]);

  function handleDownload(artifact: ExportArtifact) {
    if (!artifact.bodyText) return;
    const blob = new Blob([artifact.bodyText], { type: artifact.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy(artifact: ExportArtifact) {
    if (!artifact.bodyText) return;
    try {
      await copyArtifactToClipboard(artifact.bodyText, artifact.format);
      setCopiedId(artifact.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard access denied; Download still works.
    }
  }

  const previewArtifact = artifacts.find((a) => a.id === previewId);

  if (artifacts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase text-zinc-400">
        Exports ({artifacts.length})
      </h3>
      {artifacts.map((artifact) => (
        <div
          key={artifact.id}
          className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
        >
          <div>
            <span className="font-medium">{artifact.fileName}</span>
            <span className="ml-2 text-xs text-zinc-400">
              {new Date(artifact.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex gap-1">
            {artifact.bodyText && (
              <>
                <button
                  onClick={() =>
                    setPreviewId(previewId === artifact.id ? null : artifact.id)
                  }
                  className="rounded px-2 py-0.5 text-xs text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  {previewId === artifact.id ? "Close" : "Preview"}
                </button>
                <button
                  onClick={() => handleCopy(artifact)}
                  className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {copiedId === artifact.id ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => handleDownload(artifact)}
                  className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Download
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      {previewArtifact?.bodyText && (
        <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          {previewArtifact.format === "html" ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: previewArtifact.bodyText }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-xs font-mono">
              {previewArtifact.bodyText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
