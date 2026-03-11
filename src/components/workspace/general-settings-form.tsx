"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GeneralSettingsFormProps {
  workspaceId: string;
  workspaceSlug: string;
  name: string;
  timezone: string;
  canEdit: boolean;
}

const commonTimezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function GeneralSettingsForm({
  workspaceId,
  workspaceSlug,
  name: initialName,
  timezone: initialTimezone,
  canEdit,
}: GeneralSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(workspaceSlug);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const hasChanges =
    name !== initialName ||
    slug !== workspaceSlug ||
    timezone !== initialTimezone;

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, timezone }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      const updated = await res.json();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // If slug changed, redirect to new URL
      if (updated.slug !== workspaceSlug) {
        router.replace(`/w/${updated.slug}/settings/general`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium">Workspace name</label>
        {canEdit ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        ) : (
          <p className="mt-1 text-sm">{name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Slug</label>
        {canEdit ? (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-sm text-zinc-400">/w/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                )
              }
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        ) : (
          <p className="mt-1 font-mono text-sm">{slug}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Timezone</label>
        {canEdit ? (
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {commonTimezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
            {!commonTimezones.includes(timezone) && (
              <option value={timezone}>{timezone.replace(/_/g, " ")}</option>
            )}
          </select>
        ) : (
          <p className="mt-1 text-sm">{timezone}</p>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {success && (
            <span className="text-sm text-green-600 dark:text-green-400">
              Saved
            </span>
          )}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
