"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TiptapEditor } from "./tiptap-editor";
import { useDraftAutosave } from "./use-draft-autosave";
import { TranscriptPanel } from "./transcript-panel";
import { TranscriptIssues } from "./transcript-issues";
import { RunStatus } from "./run-status";
import { CommentPanel } from "./comment-panel";
import { ExportPanel } from "./export-panel";
import { CopyHtmlButton } from "./copy-html-button";
import { AutoTextarea } from "./auto-textarea";
import { TRANSCRIPT_DISCLAIMER } from "@/lib/disclaimer";
import { postStatusLabel } from "@/lib/status-labels";
import { ServiceSteps } from "@/components/service/service-steps";
import { WordCheckPanel, type Spot } from "@/components/service/word-check-panel";
import { useWordCheck } from "@/components/service/use-word-check";
import { serviceStepHref } from "@/lib/service-steps";
import { applySpot } from "@/lib/word-spots";
import {
  blockIndexFromId,
  isPostField,
  changedPart,
  locateText,
  type TextRun,
} from "@/lib/post-spots";
import { can } from "@/lib/permissions";
import { SectionLabel } from "@/components/ui/section-label";

type DocNode = Editor["state"]["doc"];

/** Paragraphs and headings in document order, including those in lists and quotes. */
function textblocksOf(doc: DocNode): Array<{ node: DocNode; pos: number }> {
  const blocks: Array<{ node: DocNode; pos: number }> = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    blocks.push({ node, pos });
    return false;
  });
  return blocks;
}

interface StudioClientProps {
  workspaceId: string;
  workspaceSlug: string;
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  videoTitle: string;
  videoId: string;
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
  /** Uploaded documents whose text could be read. */
  documentCount: number;
}

export function StudioClient({
  workspaceId,
  workspaceSlug,
  projectId,
  projectTitle,
  projectStatus,
  videoTitle,
  videoId,
  draft,
  transcriptSegments,
  userRole,
  documentCount,
}: StudioClientProps) {
  const router = useRouter();
  const [exportRunId, setExportRunId] = useState<string | null>(null);
  const [lastExportFormat, setLastExportFormat] = useState<
    "html" | "markdown"
  >("html");
  const [generateRunId, setGenerateRunId] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState("");

  const canEdit = can(userRole, "edit");
  const canReview = can(userRole, "review");
  const canContribute = can(userRole, "contribute");
  const fieldsEditable = canEdit && draft?.status === "working";

  // Title, intro and summary are edited as plain fields, so they are held in
  // local state and flushed on a debounce the same way the body autosaves.
  const [title, setTitle] = useState(draft?.title ?? projectTitle);
  const [intro, setIntro] = useState(draft?.intro ?? "");
  const [summary, setSummary] = useState(draft?.summary ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local fields when the draft changes
    setTitle(draft?.title ?? projectTitle);
    setIntro(draft?.intro ?? "");
    setSummary(draft?.summary ?? "");
  }, [draft?.id, draft?.title, draft?.intro, draft?.summary, projectTitle]);

  const { saving, saveFailed, queue: queueSave, isDirty, flush: flushSaves } = useDraftAutosave({
    workspaceId,
    projectId,
    draftId: draft?.id ?? null,
    enabled: canEdit,
  });

  // --- Check against the documents ---
  // Works on a post that already exists, so documents added after the post
  // was written still help. It only suggests; each fix is the person's call.
  const editorRef = useRef<Editor | null>(null);
  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);
  const fieldsRef = useRef({ title, intro, summary });
  useEffect(() => {
    fieldsRef.current = { title, intro, summary };
  }, [title, intro, summary]);

  const getPostParagraphs = useCallback(() => {
    const paragraphs: Array<{ id: string; text: string }> = [
      { id: "title", text: fieldsRef.current.title },
      { id: "intro", text: fieldsRef.current.intro },
      { id: "summary", text: fieldsRef.current.summary },
    ];
    const doc = editorRef.current?.state.doc;
    if (doc) {
      textblocksOf(doc).forEach(({ node }, index) => {
        paragraphs.push({ id: `b${index}`, text: node.textBetween(0, node.content.size, "\n", "\n") });
      });
    }
    return paragraphs.filter((p) => p.text.trim());
  }, []);

  const { spots, checkStatus, runCheck, setSpotState } = useWordCheck({
    workspaceId,
    videoId,
    getParagraphs: getPostParagraphs,
    initialStatus: "idle",
  });

  /** Where a spot's words are in the editor now, or null if they are gone. */
  const findInEditor = useCallback((spot: Spot) => {
    const editor = editorRef.current;
    const index = blockIndexFromId(spot.paragraphId);
    if (!editor || index === null) return null;
    const blocks = textblocksOf(editor.state.doc);
    const runsOf = ({ node, pos }: (typeof blocks)[number]): TextRun[] => {
      const runs: TextRun[] = [];
      node.descendants((child, childPos) => {
        if (child.isText && child.text) runs.push({ text: child.text, pos: pos + 1 + childPos });
      });
      return runs;
    };
    // The block it was found in first, then any other block, in case
    // paragraphs were added or removed since the check ran.
    const home = blocks[index];
    const found = home ? locateText(runsOf(home), spot.original) : null;
    if (found) return found;
    for (const block of blocks) {
      const range = locateText(runsOf(block), spot.original);
      if (range) return range;
    }
    return null;
  }, []);

  const handleUseSpot = useCallback(
    (spot: Spot) => {
      if (isPostField(spot.paragraphId)) {
        const field = spot.paragraphId;
        const next = applySpot(fieldsRef.current[field], spot.original, spot.suggestion);
        if (next === null) return setSpotState(spot.key, "gone");
        if (field === "title") setTitle(next);
        if (field === "intro") setIntro(next);
        if (field === "summary") setSummary(next);
        queueSave({ [field]: next });
        void flushSaves();
        return setSpotState(spot.key, "used");
      }
      const editor = editorRef.current;
      const range = findInEditor(spot);
      if (!editor || !range) return setSpotState(spot.key, "gone");
      // Only the differing middle is swapped, so unchanged words keep their
      // own formatting. locateText only returns unbroken ranges, so offsets
      // in the phrase map straight onto document positions. A plain text
      // swap goes through the editor's normal autosave and undo.
      const change = changedPart(spot.original, spot.suggestion);
      if (change) {
        editor.view.dispatch(
          editor.state.tr.insertText(change.text, range.from + change.start, range.from + change.end)
        );
      }
      setSpotState(spot.key, "used");
    },
    [findInEditor, flushSaves, queueSave, setSpotState]
  );

  const handleShowSpot = useCallback(
    (spot: Spot) => {
      if (isPostField(spot.paragraphId)) {
        const el = document.querySelector<HTMLElement>(`[data-post-field="${spot.paragraphId}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus({ preventScroll: true });
        return;
      }
      const editor = editorRef.current;
      const range = findInEditor(spot);
      if (!editor || !range) return setSpotState(spot.key, "gone");
      editor.chain().focus().setTextSelection(range).scrollIntoView().run();
    },
    [findInEditor, setSpotState]
  );

  const handleEditorUpdate = useCallback(
    (editor: Editor) =>
      queueSave(() => ({ contentJson: editor.getJSON(), plainText: editor.getText() })),
    [queueSave]
  );

  // The publish page reads the saved post as it loads, so it waits for edits
  // that are still on their way.
  function handlePublishClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || !isDirty()) return;
    e.preventDefault();
    const href = e.currentTarget.href;
    void flushSaves().finally(() => router.push(href));
  }

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
    <div className="flex flex-col lg:h-full">
      <div className="shrink-0 border-b border-zinc-200 px-4 pt-4 pb-3 dark:border-zinc-800">
        <ServiceSteps
          workspaceSlug={workspaceSlug}
          videoId={videoId}
          projectId={projectId}
          canEdit={canEdit}
          current="edit"
        />
      </div>
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Left rail - transcript. On phones it moves below the post. */}
      <div className="order-3 shrink-0 border-t border-zinc-200 p-4 lg:order-none lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-r dark:border-zinc-800">
        <SectionLabel>
          Video
        </SectionLabel>
        <p className="mt-1 text-sm font-medium">{videoTitle}</p>

        {videoId && (
          <div className="mt-3 aspect-video overflow-hidden rounded-lg">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title={`Video: ${videoTitle}`}
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        )}

        <div className="mt-4">
          <SectionLabel>
            Transcript
          </SectionLabel>
          <div className="mt-2 max-h-64 overflow-y-auto lg:max-h-[calc(100vh-500px)]">
            <TranscriptPanel segments={transcriptSegments} />
          </div>
        </div>

        <TranscriptIssues workspaceId={workspaceId} videoId={videoId} canFlag={canContribute} />
      </div>

      {/* Center - editor */}
      <div className="order-1 min-w-0 flex-1 p-4 sm:p-6 lg:order-none lg:overflow-y-auto">
        <div className="mx-auto max-w-3xl">
          {draft && fieldsEditable && (
            <WordCheckPanel
              documentCount={documentCount}
              documentsHref={
                serviceStepHref(workspaceSlug, videoId, "documents", {
                  projectId,
                  canEdit: true,
                })!
              }
              status={checkStatus}
              spots={spots}
              paragraphStart={() => null}
              onUse={handleUseSpot}
              onKeep={(spot) => setSpotState(spot.key, "kept")}
              onShow={handleShowSpot}
              onRetry={() => void runCheck()}
              subject="this post"
              allDoneMessage="All checked. The post matches your documents."
              className="mb-6 rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3 dark:border-blue-900/60 dark:bg-blue-950/10"
            />
          )}
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            {draft ? (
              <input
                value={title}
                data-post-field="title"
                readOnly={!fieldsEditable}
                onChange={(e) => {
                  setTitle(e.target.value);
                  queueSave({ title: e.target.value });
                }}
                placeholder="Post title"
                aria-label="Post title"
                className="min-w-0 flex-1 basis-64 rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-bold outline-none read-only:cursor-default hover:border-zinc-200 focus:border-blue-500 dark:hover:border-zinc-700"
              />
            ) : (
              <h1 className="text-2xl font-bold">{projectTitle}</h1>
            )}
            <div aria-live="polite" className="flex min-w-0 flex-wrap items-center gap-2 pt-2">
              <span className="whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {postStatusLabel(projectStatus)}
              </span>
              {saving && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Saving...</span>
              )}
              {!saving && saveFailed && (
                <span className="text-xs font-medium text-red-600">
                  Save failed. Check your connection; edits retry on your next
                  change.
                </span>
              )}
            </div>
          </div>

          {draft ? (
            <div className="mt-6 space-y-6">
              {/* Intro */}
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                <SectionLabel tone="accent">
                  Introduction
                </SectionLabel>
                <AutoTextarea
                  value={intro}
                  fieldId="intro"
                  readOnly={!fieldsEditable}
                  placeholder="Introduce the post for readers..."
                  className="mt-1"
                  onChange={(value) => {
                    setIntro(value);
                    queueSave({ intro: value });
                  }}
                />
              </div>

              {/* Summary */}
              <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
                <SectionLabel>
                  Summary
                </SectionLabel>
                <AutoTextarea
                  value={summary}
                  fieldId="summary"
                  readOnly={!fieldsEditable}
                  placeholder="Summarize the key points..."
                  className="mt-1"
                  onChange={(value) => {
                    setSummary(value);
                    queueSave({ summary: value });
                  }}
                />
              </div>

              {/*
                The disclaimer is rendered by the exporter, not stored in the
                draft body, so it is shown here read-only as a preview of what
                readers will see above the transcript.
              */}
              <div className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
                <SectionLabel>
                  Transcript notice (added on export)
                </SectionLabel>
                <p className="mt-1 text-sm italic text-zinc-500">
                  {TRANSCRIPT_DISCLAIMER}
                </p>
              </div>

              {/* Tiptap Editor */}
              <TiptapEditor
                content={draft.contentJson}
                onUpdate={canEdit ? handleEditorUpdate : undefined}
                onReady={handleEditorReady}
                editable={fieldsEditable}
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
            <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>
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
      <div className="order-2 shrink-0 border-t border-zinc-200 p-4 lg:order-none lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l dark:border-zinc-800">
        <SectionLabel>
          Details
        </SectionLabel>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd className="font-medium">{postStatusLabel(projectStatus)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Draft</dt>
            <dd className="font-medium">
              {draft ? `Version ${draft.versionNumber}` : "Not written yet"}
            </dd>
          </div>
        </dl>

        {/* Review Actions */}
        <div className="mt-6 space-y-2">
          <SectionLabel>
            Approval (optional)
          </SectionLabel>

          {canEdit && projectStatus === "drafting" && draft && (
            <button
              onClick={() => handleReviewAction("request_review")}
              disabled={reviewLoading}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Ask for approval
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
                Request changes
              </button>
            </>
          )}
        </div>

        {/* Export Actions */}
        {draft && (
          <div id="publish" className="mt-6 scroll-mt-4 space-y-2">
            <SectionLabel>
              Publish
            </SectionLabel>
            <Link
              href={`/w/${workspaceSlug}/services/${videoId}/publish`}
              onClick={handlePublishClick}
              className="flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Publish to Squarespace
            </Link>
            <p className="pt-2 text-xs text-zinc-500">Or copy it all at once:</p>
            <CopyHtmlButton workspaceId={workspaceId} projectId={projectId} />

            {canContribute && (
              <>
                <SectionLabel className="pt-3">
                  Download a file
                </SectionLabel>
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
              </>
            )}
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
            canComment={canContribute}
          />
        </div>
      </div>
    </div>
      {/* Phones: the next step stays in reach while editing */}
      {draft && (
        <div className="sticky bottom-0 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
          <Link
            href={`/w/${workspaceSlug}/services/${videoId}/publish`}
            onClick={handlePublishClick}
            className="flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Publish to Squarespace
          </Link>
        </div>
      )}
    </div>
  );
}
