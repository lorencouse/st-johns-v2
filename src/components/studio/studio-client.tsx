"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "./tiptap-editor";
import { TranscriptPanel } from "./transcript-panel";
import { TranscriptIssues } from "./transcript-issues";
import { RunStatus } from "./run-status";
import { CommentPanel } from "./comment-panel";
import { ExportPanel } from "./export-panel";

interface StudioClientProps {
  workspaceId: string;
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  videoTitle: string;
  videoId: string;
  providerVideoId: string;
  draft: {
    id: string;
    versionNumber: number;
    status: string;
    title: string;
    intro: string | null;
    summary: string | null;
    contentJson: Record<string, unknown>;
  } | null;
  transcriptSegments: Array<{
    seq: number;
    startMs: number;
    endMs: number;
    text: string;
  }>;
  userRole: string;
}

export function StudioClient({
  workspaceId,
  projectId,
  projectTitle,
  projectStatus,
  videoTitle,
  videoId,
  providerVideoId,
  draft,
  transcriptSegments,
  userRole,
}: StudioClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [exportRunId, setExportRunId] = useState<string | null>(null);
  const [lastExportFormat, setLastExportFormat] = useState<
    "html" | "markdown"
  >("html");
  const [generateRunId, setGenerateRunId] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState("");

  const canEdit = ["owner", "admin", "editor"].includes(userRole);
  const canReview = ["owner", "admin", "reviewer"].includes(userRole);

  const handleEditorUpdate = useCallback(
    async (json: Record<string, unknown>, text: string) => {
      if (!draft || !canEdit) return;
      setSaving(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/projects/${projectId}/drafts`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              draftVersionId: draft.id,
              contentJson: json,
              plainText: text,
            }),
          }
        );
        setSaveFailed(!res.ok);
      } catch {
        // Editing continues locally; the next keystroke retries the save.
        setSaveFailed(true);
      } finally {
        setSaving(false);
      }
    },
    [draft, canEdit, workspaceId, projectId]
  );

  async function handleExport(format: "html" | "markdown") {
    setError("");
    setLastExportFormat(format);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Export failed");
        return;
      }
      const data = await res.json();
      setExportRunId(data.runId);
    } catch {
      setError("Export failed");
    }
  }

  async function handleGenerate() {
    setGenerateLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/videos/${videoId}/generate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start generation");
        return;
      }
      const data = await res.json();
      setGenerateRunId(data.runId);
    } catch {
      setError("Failed to start generation");
    } finally {
      setGenerateLoading(false);
    }
  }

  async function handleReviewAction(
    action: "request_review" | "approve" | "request_changes"
  ) {
    setReviewLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Action failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Action failed");
    } finally {
      setReviewLoading(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* Left rail - transcript */}
      <div className="w-80 shrink-0 overflow-y-auto border-r border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-xs font-semibold uppercase text-zinc-400">
          Source Video
        </h3>
        <p className="mt-1 text-sm font-medium">{videoTitle}</p>

        {providerVideoId && (
          <div className="mt-3 aspect-video overflow-hidden rounded-lg">
            <iframe
              src={`https://www.youtube.com/embed/${providerVideoId}`}
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase text-zinc-400">
            Transcript
          </h3>
          <div className="mt-2 max-h-[calc(100vh-500px)] overflow-y-auto">
            <TranscriptPanel segments={transcriptSegments} />
          </div>
        </div>

        <TranscriptIssues workspaceId={workspaceId} videoId={videoId} />
      </div>

      {/* Center - editor */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{projectTitle}</h1>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {projectStatus.replace("_", " ")}
              </span>
              {saving && (
                <span className="text-xs text-zinc-400">Saving...</span>
              )}
              {!saving && saveFailed && (
                <span className="text-xs font-medium text-red-600">
                  Save failed — check your connection; edits retry on your next
                  change
                </span>
              )}
            </div>
          </div>

          {draft ? (
            <div className="mt-6 space-y-6">
              {/* Intro */}
              {draft.intro && (
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                  <h3 className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400">
                    Introduction
                  </h3>
                  <p className="mt-1 text-sm">{draft.intro}</p>
                </div>
              )}

              {/* Summary */}
              {draft.summary && (
                <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
                  <h3 className="text-xs font-semibold uppercase text-zinc-400">
                    Summary
                  </h3>
                  <p className="mt-1 text-sm">{draft.summary}</p>
                </div>
              )}

              {/* Tiptap Editor */}
              <TiptapEditor
                content={draft.contentJson}
                onUpdate={canEdit ? handleEditorUpdate : undefined}
                editable={canEdit && draft.status === "working"}
              />
            </div>
          ) : (
            <div className="mt-16 space-y-4 text-center">
              <p className="text-zinc-500">
                No draft generated yet for this video.
              </p>
              {canEdit && !generateRunId && (
                <button
                  onClick={handleGenerate}
                  disabled={generateLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {generateLoading ? "Starting..." : "Generate draft"}
                </button>
              )}
              {generateRunId && (
                <div className="mx-auto max-w-sm">
                  <RunStatus
                    runId={generateRunId}
                    onSuccess={() => {
                      setGenerateRunId(null);
                      router.refresh();
                    }}
                    onRetry={() => {
                      setGenerateRunId(null);
                      void handleGenerate();
                    }}
                    onDismiss={() => setGenerateRunId(null)}
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}

          {exportRunId && (
            <div className="mt-4">
              <RunStatus
                runId={exportRunId}
                onSuccess={() => {
                  setExportRunId(null);
                  router.refresh();
                }}
                onRetry={() => {
                  setExportRunId(null);
                  void handleExport(lastExportFormat);
                }}
                onDismiss={() => setExportRunId(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right panel - actions */}
      <div className="w-72 shrink-0 overflow-y-auto border-l border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="text-xs font-semibold uppercase text-zinc-400">
          Details
        </h3>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-400">Status</dt>
            <dd className="font-medium">{projectStatus.replace("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Draft</dt>
            <dd className="font-medium">
              {draft ? `v${draft.versionNumber} (${draft.status})` : "—"}
            </dd>
          </div>
        </dl>

        {/* Review Actions */}
        <div className="mt-6 space-y-2">
          <h3 className="text-xs font-semibold uppercase text-zinc-400">
            Review
          </h3>

          {canEdit && projectStatus === "drafting" && draft && (
            <button
              onClick={() => handleReviewAction("request_review")}
              disabled={reviewLoading}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Request Review
            </button>
          )}

          {canReview && projectStatus === "ready_for_review" && (
            <>
              <button
                onClick={() => handleReviewAction("approve")}
                disabled={reviewLoading}
                className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleReviewAction("request_changes")}
                disabled={reviewLoading}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Request Changes
              </button>
            </>
          )}
        </div>

        {/* Export Actions */}
        {draft && (
          <div className="mt-6 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-zinc-400">
              Export
            </h3>
            <button
              onClick={() => handleExport("html")}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Export HTML
            </button>
            <button
              onClick={() => handleExport("markdown")}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Export Markdown
            </button>
          </div>
        )}

        {/* Export Artifacts */}
        <div className="mt-6">
          <ExportPanel workspaceId={workspaceId} projectId={projectId} />
        </div>

        {/* Comments */}
        <div className="mt-6">
          <CommentPanel
            workspaceId={workspaceId}
            projectId={projectId}
            draftVersionId={draft?.id ?? null}
          />
        </div>
      </div>
    </div>
  );
}
