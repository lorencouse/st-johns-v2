"use client";

import { useState, useEffect, useCallback } from "react";

interface Issue {
  id: string;
  issueType: string;
  anchorStartMs: number | null;
  anchorEndMs: number | null;
  note: string | null;
  status: string;
  createdAt: string;
  createdByName: string | null;
}

interface TranscriptIssuesProps {
  workspaceId: string;
  videoId: string;
}

const ISSUE_TYPES = [
  { value: "inaccurate", label: "Inaccurate text" },
  { value: "missing", label: "Missing content" },
  { value: "timing", label: "Timing issue" },
  { value: "speaker", label: "Wrong speaker" },
  { value: "other", label: "Other" },
];

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function TranscriptIssues({
  workspaceId,
  videoId,
}: TranscriptIssuesProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [issueType, setIssueType] = useState("inaccurate");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/videos/${videoId}/issues`
      );
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues);
      }
    } catch {
      // Silent fail
    }
  }, [workspaceId, videoId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/videos/${videoId}/issues`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueType, note }),
        }
      );
      if (res.ok) {
        setNote("");
        setShowForm(false);
        await fetchIssues();
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(issueId: string) {
    try {
      await fetch(
        `/api/workspaces/${workspaceId}/videos/${videoId}/issues/${issueId}`,
        { method: "PATCH" }
      );
      await fetchIssues();
    } catch {
      // Silent fail
    }
  }

  const openIssues = issues.filter((i) => i.status === "open");
  const resolvedIssues = issues.filter((i) => i.status === "resolved");

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-zinc-400">
          Issues ({openIssues.length})
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs text-blue-500 hover:text-blue-700"
        >
          {showForm ? "Cancel" : "Flag issue"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          >
            {ISSUE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe the issue..."
            rows={2}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="submit"
            disabled={loading || !note.trim()}
            className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            Submit Issue
          </button>
        </form>
      )}

      {openIssues.map((issue) => (
        <div
          key={issue.id}
          className="rounded border border-red-200 bg-red-50 p-2 text-xs dark:border-red-900/50 dark:bg-red-900/10"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium capitalize">{issue.issueType.replace("_", " ")}</span>
            <button
              onClick={() => handleResolve(issue.id)}
              className="text-green-600 hover:text-green-800"
            >
              Resolve
            </button>
          </div>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{issue.note}</p>
          {issue.anchorStartMs != null && (
            <span className="mt-1 inline-block font-mono text-zinc-400">
              {formatMs(issue.anchorStartMs)}
              {issue.anchorEndMs != null && ` – ${formatMs(issue.anchorEndMs)}`}
            </span>
          )}
          <div className="mt-1 text-zinc-400">
            {issue.createdByName} · {new Date(issue.createdAt).toLocaleDateString()}
          </div>
        </div>
      ))}

      {resolvedIssues.length > 0 && (
        <p className="text-xs text-zinc-400">
          {resolvedIssues.length} resolved issue{resolvedIssues.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
