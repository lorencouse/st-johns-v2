import { NextRequest, NextResponse } from "next/server";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { db } from "@/server/db";
import {
  contentProjects,
  draftVersions,
  sourceVideos,
} from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { renderHtml } from "@/server/export/render";
import { blocksFromContentJson } from "@/server/content/document";

// Renders the active draft to HTML on the spot. The queued export job still
// owns stored artifacts; this exists so "Copy HTML" is instant rather than a
// job the editor has to wait on.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; projectId: string }> }
) {
  const { workspaceId, projectId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const embed =
    req.nextUrl.searchParams.get("embed") === "link" ? "link" : "iframe";

  const [row] = await db
    .select({
      videoId: sourceVideos.id,
      activeDraftVersionId: contentProjects.activeDraftVersionId,
    })
    .from(contentProjects)
    .innerJoin(sourceVideos, eq(sourceVideos.id, contentProjects.sourceVideoId))
    .where(
      and(
        eq(contentProjects.id, projectId),
        eq(contentProjects.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!row.activeDraftVersionId) {
    return NextResponse.json(
      { error: "No active draft to copy" },
      { status: 400 }
    );
  }

  const [draft] = await db
    .select()
    .from(draftVersions)
    .where(
      and(
        eq(draftVersions.id, row.activeDraftVersionId),
        eq(draftVersions.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const html = renderHtml(row.videoId, blocksFromContentJson(draft.contentJson), {
    intro: draft.intro,
    summary: draft.summary,
    // The title is a Squarespace field of its own, so it is only baked into
    // the body for the formatted paste where nothing else carries it.
    title: embed === "link" ? draft.title : null,
    embed,
  });

  return NextResponse.json({ html, title: draft.title });
}
