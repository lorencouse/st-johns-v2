import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireApiWorkspaceMember } from "@/lib/api-helpers";
import { imageFileName, isYouTubeVideoId } from "@/lib/published-url";
import { db } from "@/server/db";
import { contentProjects } from "@/server/db/schema";

// Largest first. Not every video has a maxres still, so fall back in order.
const SIZES = ["maxresdefault", "sddefault", "hqdefault"];

/**
 * The video's YouTube still, sent as a download so staff can upload it as the
 * Squarespace featured image. Only i.ytimg.com is ever fetched, with an id
 * that has been checked, so the address cannot be pointed anywhere else.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; projectId: string }> }
) {
  const { workspaceId, projectId } = await params;
  const ctx = await requireApiWorkspaceMember(workspaceId);
  if ("error" in ctx) return ctx.error;

  const [project] = await db
    .select({
      videoId: contentProjects.sourceVideoId,
      title: contentProjects.title,
    })
    .from(contentProjects)
    .where(
      and(
        eq(contentProjects.id, projectId),
        eq(contentProjects.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!project || !isYouTubeVideoId(project.videoId)) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  for (const size of SIZES) {
    const res = await fetch(
      `https://i.ytimg.com/vi/${project.videoId}/${size}.jpg`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    ).catch(() => null);
    if (!res?.ok) continue;
    const bytes = await res.arrayBuffer().catch(() => null);
    if (!bytes) continue;
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${imageFileName(project.title)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return NextResponse.json(
    { error: "YouTube has no image for this video yet." },
    { status: 502 }
  );
}
