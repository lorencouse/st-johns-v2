"use client";

import { useState, useEffect, useCallback } from "react";

interface Comment {
  id: string;
  body: string;
  userName: string | null;
  createdAt: string;
}

interface Thread {
  id: string;
  anchorType: string;
  anchorKey: string | null;
  createdAt: string;
  resolvedAt: string | null;
  createdByName: string | null;
  comments: Comment[];
}

interface CommentPanelProps {
  workspaceId: string;
  projectId: string;
  draftVersionId: string | null;
}

export function CommentPanel({
  workspaceId,
  projectId,
  draftVersionId,
}: CommentPanelProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/comments`
      );
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads);
      }
    } catch {
      // Silent fail
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleNewThread(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anchorType: "document",
            comment: newComment,
            draftVersionId,
          }),
        }
      );
      if (res.ok) {
        setNewComment("");
        await fetchComments();
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  async function handleReply(threadId: string) {
    if (!replyText.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/comments/${threadId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: replyText }),
        }
      );
      if (res.ok) {
        setReplyText("");
        setReplyingTo(null);
        await fetchComments();
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(threadId: string) {
    try {
      await fetch(
        `/api/workspaces/${workspaceId}/projects/${projectId}/comments/${threadId}`,
        { method: "PATCH" }
      );
      await fetchComments();
    } catch {
      // Silent fail
    }
  }

  const openThreads = threads.filter((t) => !t.resolvedAt);
  const resolvedThreads = threads.filter((t) => t.resolvedAt);
  const visibleThreads = showResolved ? threads : openThreads;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-zinc-400">
          Comments ({openThreads.length})
        </h3>
        {resolvedThreads.length > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            {showResolved ? "Hide resolved" : `+${resolvedThreads.length} resolved`}
          </button>
        )}
      </div>

      {/* New comment form */}
      <form onSubmit={handleNewThread}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
        />
        {newComment.trim() && (
          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Comment
          </button>
        )}
      </form>

      {/* Thread list */}
      <div className="space-y-3">
        {visibleThreads.map((thread) => (
          <div
            key={thread.id}
            className={`rounded-lg border p-3 text-sm ${
              thread.resolvedAt
                ? "border-zinc-200 opacity-60 dark:border-zinc-800"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {thread.comments.map((c) => (
              <div key={c.id} className="mb-2 last:mb-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-xs">
                    {c.userName || "User"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-0.5 text-sm">{c.body}</p>
              </div>
            ))}

            {!thread.resolvedAt && (
              <div className="mt-2 flex gap-2">
                {replyingTo === thread.id ? (
                  <div className="flex-1">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Reply..."
                      rows={1}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <div className="mt-1 flex gap-1">
                      <button
                        onClick={() => handleReply(thread.id)}
                        disabled={loading}
                        className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText("");
                        }}
                        className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setReplyingTo(thread.id)}
                      className="text-xs text-zinc-400 hover:text-zinc-600"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => handleResolve(thread.id)}
                      className="text-xs text-green-500 hover:text-green-700"
                    >
                      Resolve
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
