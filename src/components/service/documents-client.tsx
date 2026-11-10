"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CircleCheck, FileText, Loader2, TriangleAlert, Upload } from "lucide-react";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_KIND_LABELS,
  documentProblem,
  formatFileSize,
  type DocumentKind,
} from "@/lib/documents";
import { serviceStepHref } from "@/lib/service-steps";
import { ServiceStepFrame } from "./service-step-frame";
import { buttonStepBack, buttonStepPrimary } from "@/components/ui/button";

interface UploadedDocument {
  id: string;
  kind: string;
  fileName: string;
  sizeBytes: number;
  textStatus: string;
  createdAt: string;
}

interface DocumentsClientProps {
  workspaceId: string;
  workspaceSlug: string;
  videoId: string;
  videoTitle: string;
  projectId: string | null;
  captionsReady: boolean;
  storageReady: boolean;
  initialDocuments: UploadedDocument[];
}

const SLOTS: Array<{ kind: DocumentKind; hint: string }> = [
  { kind: "sermon", hint: "A PDF or Word file, or a photo of the pages" },
  { kind: "bulletin", hint: "The printed pamphlet, as a PDF or a photo" },
];

export function DocumentsClient({
  workspaceId,
  workspaceSlug,
  videoId,
  videoTitle,
  projectId,
  captionsReady,
  storageReady,
  initialDocuments,
}: DocumentsClientProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState<DocumentKind | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});

  const api = `/api/workspaces/${workspaceId}/videos/${videoId}/documents`;
  // Onward to the post if one exists, to checking the words once captions
  // are in, or back to the video page while captions are still coming.
  const nextHref = projectId
    ? serviceStepHref(workspaceSlug, videoId, "edit", { projectId, canEdit: true })!
    : captionsReady
      ? serviceStepHref(workspaceSlug, videoId, "words", { projectId, canEdit: true })!
      : serviceStepHref(workspaceSlug, videoId, "video", { projectId, canEdit: true })!;

  async function upload(kind: DocumentKind, file: File) {
    const problem = documentProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setUploading(kind);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const res = await fetch(api, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "We couldn't add that file. Try again.");
        return;
      }
      setDocuments((prev) => [...prev, { ...data.document, createdAt: String(data.document.createdAt) }]);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setUploading(null);
      const input = inputs.current[kind];
      if (input) input.value = "";
    }
  }

  async function remove(doc: UploadedDocument) {
    setRemoving(doc.id);
    setError("");
    try {
      const res = await fetch(`${api}/${doc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "We couldn't remove that file. Try again.");
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setRemoving(null);
    }
  }

  function fileList(kind: DocumentKind) {
    const docs = documents.filter((d) => d.kind === kind);
    if (docs.length === 0) return null;
    return (
      <ul className="space-y-2">
        {docs.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {doc.textStatus === "done" ? (
              <CircleCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <a
                href={`${api}/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-medium hover:underline"
              >
                {doc.fileName}
              </a>
              <p className="text-xs text-zinc-500">
                {doc.textStatus === "done"
                  ? `Read and ready · ${formatFileSize(doc.sizeBytes)}`
                  : "Saved, but we couldn't read the words in it. A clearer photo or a PDF works better."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void remove(doc)}
              disabled={removing === doc.id}
              className="min-h-11 shrink-0 px-2 text-sm font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50"
            >
              {removing === doc.id ? "Removing..." : "Remove"}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function slot(kind: DocumentKind, hint: string) {
    const busy = uploading === kind;
    const inputId = `upload-${kind}`;
    return (
      <section key={kind} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <h2 className="font-semibold">{DOCUMENT_KIND_LABELS[kind]}</h2>
        </div>
        {fileList(kind)}
        <label
          htmlFor={inputId}
          className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
            busy
              ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
              : "border-zinc-300 hover:border-blue-500 hover:bg-blue-50/50 dark:border-zinc-700 dark:hover:bg-blue-950/20"
          } ${!storageReady || uploading ? "pointer-events-none opacity-60" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file && storageReady && !uploading) void upload(kind, file);
          }}
        >
          {busy ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
              <span className="text-sm font-medium">Adding and reading the file...</span>
            </>
          ) : (
            <>
              <Upload className="h-6 w-6 text-blue-600" aria-hidden="true" />
              <span className="text-sm font-medium">
                {documents.some((d) => d.kind === kind) ? "Add another file" : "Choose a file or drop it here"}
              </span>
              <span className="text-xs text-zinc-500">{hint}</span>
            </>
          )}
        </label>
        <input
          ref={(el) => {
            inputs.current[kind] = el;
          }}
          id={inputId}
          type="file"
          accept={DOCUMENT_ACCEPT}
          className="sr-only"
          disabled={!storageReady || !!uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(kind, file);
          }}
        />
      </section>
    );
  }

  return (
    <ServiceStepFrame
      steps={{ workspaceSlug, videoId, projectId, canEdit: true, current: "documents" }}
      title="Add the sermon and bulletin"
      description={
        projectId
          ? "The post is already written. Add the files here, then go back to the post and press Check against the documents to fix names, Bible verses and hymn titles. These files are never published."
          : "Optional, but it helps the post get names, Bible verses and hymn titles right. These files are never published."
      }
      subtitle={videoTitle}
      footer={
        <>
          <Link
            href={`/w/${workspaceSlug}/services/${videoId}`}
            className={buttonStepBack}
          >
            Back
          </Link>
          <Link
            href={nextHref}
            aria-disabled={!!uploading}
            className={`${buttonStepPrimary} ${uploading ? "pointer-events-none opacity-50" : ""}`}
          >
            {projectId ? "Back to the post" : documents.length > 0 ? "Continue" : "Skip for now"}
          </Link>
        </>
      }
    >
      {!storageReady && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          Document upload isn&apos;t switched on for this site yet. You can
          skip this step for now.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {SLOTS.map((s) => slot(s.kind, s.hint))}
      </div>
      {slot("other", "Anything else that helps, like a list of readings")}

      <p aria-live="polite" className="min-h-6 text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    </ServiceStepFrame>
  );
}
