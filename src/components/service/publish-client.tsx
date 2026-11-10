"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Check,
  CircleCheck,
  ClipboardCopy,
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { htmlToPlainText, writeRichHtml } from "@/lib/clipboard";
import { imageFileName } from "@/lib/published-url";
import { ServiceStepFrame } from "./service-step-frame";
import { buttonBase, buttonDone, buttonSecondary, buttonStepBack } from "@/components/ui/button";

interface PublishClientProps {
  workspaceId: string;
  workspaceSlug: string;
  videoId: string;
  projectId: string;
  title: string;
  excerpt: string;
  canEdit: boolean;
  publishedAt: string | null;
  publishedUrl: string | null;
}

type StepKey = "open" | "title" | "body" | "video" | "image" | "alt" | "excerpt";

export function PublishClient({
  workspaceId,
  workspaceSlug,
  videoId,
  projectId,
  title,
  excerpt,
  canEdit,
  publishedAt: initialPublishedAt,
  publishedUrl: initialPublishedUrl,
}: PublishClientProps) {
  const router = useRouter();
  const [done, setDone] = useState<Partial<Record<StepKey, boolean>>>({});
  const [bodyHtml, setBodyHtml] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [liveUrl, setLiveUrl] = useState(initialPublishedUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [publishedUrl, setPublishedUrl] = useState(initialPublishedUrl);

  const api = `/api/workspaces/${workspaceId}/projects/${projectId}`;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const altText = title;

  // Fetch the post body up front, so pressing "Copy post" writes to the
  // clipboard straight away. Some browsers refuse a copy that waits on the
  // network after the click.
  useEffect(() => {
    let cancelled = false;
    fetch(`${api}/render?embed=link&title=omit`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { html: string }) => {
        if (!cancelled) setBodyHtml(data.html);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load the post. Refresh the page to try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  function tick(key: StepKey, note: string) {
    setDone((prev) => ({ ...prev, [key]: true }));
    setMessage(note);
    setError("");
  }

  async function copyText(key: StepKey, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      tick(key, "Copied. Now paste it into Squarespace.");
    } catch {
      setError("Your browser blocked copying. Select the text and copy it by hand.");
    }
  }

  async function copyBody() {
    if (!bodyHtml) return;
    try {
      await writeRichHtml(bodyHtml, htmlToPlainText(bodyHtml));
      tick("body", "Copied. Click into the post's text area in Squarespace and paste.");
    } catch {
      setError("Your browser blocked copying. Try the raw HTML option below.");
    }
  }

  async function downloadImage() {
    setError("");
    try {
      const res = await fetch(`${api}/featured-image`, {
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "We couldn't get the image. Try again.");
        return;
      }
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) {
        setError("We couldn't get the image. Try again.");
        return;
      }
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = imageFileName(title);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      tick("image", "Image downloaded. Upload it as the featured image.");
    } catch {
      setError("We couldn't get the image. Check your connection and try again.");
    }
  }

  async function copyRawHtml() {
    try {
      const res = await fetch(`${api}/render?embed=iframe`);
      if (!res.ok) throw new Error();
      const { html } = (await res.json()) as { html: string };
      await navigator.clipboard.writeText(html);
      setMessage("HTML copied. Paste it into a Code Block in Squarespace.");
      setError("");
    } catch {
      setError("We couldn't copy the HTML. Try again.");
    }
  }

  async function markPublished() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${api}/published`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: liveUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "We couldn't save that. Try again.");
        return;
      }
      setPublishedAt(data.publishedAt);
      setPublishedUrl(data.publishedUrl);
      setLiveUrl(data.publishedUrl ?? "");
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function markNotPublished() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${api}/published`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "We couldn't change that. Try again.");
        return;
      }
      setPublishedAt(null);
      setPublishedUrl(null);
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const steps: Array<{
    key: string;
    title: string;
    hint: string;
    action: React.ReactNode;
    finished: boolean;
  }> = [
    {
      key: "open",
      title: "Open your blog in Squarespace",
      hint: "Go to Pages, open your blog, and click + to start a new post.",
      finished: !!done.open,
      action: (
        <a
          href="https://login.squarespace.com"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => tick("open", "Squarespace opened in a new tab. Come back here for each piece.")}
          className={done.open ? buttonDone : buttonSecondary}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open Squarespace
        </a>
      ),
    },
    {
      key: "title",
      title: "Title",
      hint: title,
      finished: !!done.title,
      action: (
        <button
          type="button"
          onClick={() => void copyText("title", title)}
          className={done.title ? buttonDone : buttonSecondary}
        >
          {done.title ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
          {done.title ? "Copied" : "Copy title"}
        </button>
      ),
    },
    {
      key: "body",
      title: "The post",
      hint: "Click into the post's text area, then paste. Headings and links come with it.",
      finished: !!done.body,
      action: (
        <button
          type="button"
          onClick={() => void copyBody()}
          disabled={!bodyHtml}
          className={done.body ? buttonDone : buttonSecondary}
        >
          {!bodyHtml ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : done.body ? (
            <Check className="h-4 w-4" />
          ) : (
            <ClipboardCopy className="h-4 w-4" />
          )}
          {done.body ? "Copied" : "Copy post"}
        </button>
      ),
    },
    {
      key: "video",
      title: "The video (optional)",
      hint: "To show the video in the post, add a Video block and paste this link.",
      finished: !!done.video,
      action: (
        <button
          type="button"
          onClick={() => void copyText("video", videoUrl)}
          className={done.video ? buttonDone : buttonSecondary}
        >
          {done.video ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
          {done.video ? "Copied" : "Copy video link"}
        </button>
      ),
    },
    {
      key: "image",
      title: "Featured image",
      hint: "In the post's Options, open Featured image and upload this picture. Then paste the description into its alt text.",
      finished: !!done.image && !!done.alt,
      action: (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void downloadImage()}
            className={done.image ? buttonDone : buttonSecondary}
          >
            {done.image ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {done.image ? "Downloaded" : "Download image"}
          </button>
          <button
            type="button"
            onClick={() => void copyText("alt", altText)}
            className={done.alt ? buttonDone : buttonSecondary}
          >
            {done.alt ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
            {done.alt ? "Copied" : "Copy description"}
          </button>
        </div>
      ),
    },
  ];

  if (excerpt) {
    steps.push({
      key: "excerpt",
      title: "Excerpt",
      hint: "In the post's Options, paste this into Excerpt. It's the short preview on your blog page.",
      finished: !!done.excerpt,
      action: (
        <button
          type="button"
          onClick={() => void copyText("excerpt", excerpt)}
          className={done.excerpt ? buttonDone : buttonSecondary}
        >
          {done.excerpt ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
          {done.excerpt ? "Copied" : "Copy excerpt"}
        </button>
      ),
    });
  }

  const publishedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <ServiceStepFrame
      steps={{ workspaceSlug, videoId, projectId, canEdit, current: "publish" }}
      title="Put it on Squarespace"
      description={
        <>
          Keep this page open next to Squarespace. Copy each piece, then paste
          it into the matching place there.
        </>
      }
      footer={
        <>
          <Link
            href={`/w/${workspaceSlug}/projects/${projectId}`}
            className={buttonStepBack}
          >
            Back to the post
          </Link>
          <Link
            href={`/w/${workspaceSlug}/library`}
            className="inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {publishedAt ? "Back to services" : "Finish later"}
          </Link>
        </>
      }
    >
      {publishedDate && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200">
            <CircleCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            Published on {publishedDate}
          </p>
          {publishedUrl && (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 max-w-full items-center gap-1.5 text-sm font-medium text-emerald-800 underline dark:text-emerald-200"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{publishedUrl}</span>
            </a>
          )}
        </section>
      )}

      <ol className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums ${
                  step.finished
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
                }`}
              >
                {step.finished ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium">
                  {step.title}
                  {step.finished && <span className="sr-only"> (done)</span>}
                </p>
                <p className="mt-0.5 text-sm text-pretty break-words text-zinc-500">
                  {step.hint}
                </p>
              </div>
            </div>
            <div className="pl-11 sm:pl-0">{step.action}</div>
          </li>
        ))}
        <li className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums ${
                publishedAt
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
              }`}
            >
              {publishedAt ? <Check className="h-4 w-4" /> : steps.length + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium">Press Publish in Squarespace</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                Then come back and tell us, so everyone knows it&apos;s on the
                website.
              </p>
            </div>
          </div>
          {canEdit ? (
            <div className="space-y-3 pl-11">
              <div className="space-y-1.5">
                <label htmlFor="live-url" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Link to the live post (optional)
                </label>
                <input
                  id="live-url"
                  type="url"
                  inputMode="url"
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  placeholder="https://yourchurch.org/blog/..."
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void markPublished()}
                  disabled={saving}
                  className={`${buttonBase} min-h-12 bg-blue-600 px-6 text-base font-semibold text-white hover:bg-blue-700`}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {publishedAt ? "Save link" : "I've published it"}
                </button>
                {publishedAt && (
                  <button
                    type="button"
                    onClick={() => void markNotPublished()}
                    disabled={saving}
                    className="min-h-11 px-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Mark as not published
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="pl-11 text-sm text-zinc-500">
              Someone with editing access marks the post as published.
            </p>
          )}
        </li>
      </ol>

      <p aria-live="polite" className="min-h-6 text-sm">
        {error ? (
          <span className="text-red-600 dark:text-red-400">{error}</span>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-400">{message}</span>
        )}
      </p>

      <details className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">
          Other ways to copy
        </summary>
        <div className="mt-2 space-y-2 text-sm text-zinc-500">
          <p>
            If pasting the post loses its formatting, copy it as HTML and
            paste it into a Code Block instead.
          </p>
          <button type="button" onClick={() => void copyRawHtml()} className={buttonSecondary}>
            <ClipboardCopy className="h-4 w-4" />
            Copy raw HTML
          </button>
        </div>
      </details>
    </ServiceStepFrame>
  );
}
