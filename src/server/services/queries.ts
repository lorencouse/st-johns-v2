import { db } from "@/server/db";
import { workspaceVideos } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

/** The video's row in this workspace, or undefined if it is not in the workspace. */
export async function findWorkspaceVideo(workspaceId: string, videoId: string) {
  const [row] = await db
    .select()
    .from(workspaceVideos)
    .where(
      and(
        eq(workspaceVideos.workspaceId, workspaceId),
        eq(workspaceVideos.videoId, videoId)
      )
    )
    .limit(1);
  return row;
}
