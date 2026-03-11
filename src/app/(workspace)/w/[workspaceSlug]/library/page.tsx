import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  sourceVideos,
  youtubeChannels,
  contentProjects,
} from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { VideoRow } from "@/components/library/video-row";
import Link from "next/link";

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const videos = await db
    .select({
      video: sourceVideos,
      channelTitle: youtubeChannels.title,
    })
    .from(sourceVideos)
    .leftJoin(youtubeChannels, eq(youtubeChannels.id, sourceVideos.channelId))
    .where(eq(sourceVideos.workspaceId, workspace.id))
    .orderBy(desc(sourceVideos.publishedAt))
    .limit(100);

  // Get project status for each video
  const projectsByVideo = new Map<
    string,
    { id: string; status: string }
  >();

  if (videos.length > 0) {
    const projects = await db
      .select({
        id: contentProjects.id,
        sourceVideoId: contentProjects.sourceVideoId,
        status: contentProjects.status,
      })
      .from(contentProjects)
      .where(eq(contentProjects.workspaceId, workspace.id));

    for (const p of projects) {
      projectsByVideo.set(p.sourceVideoId, { id: p.id, status: p.status });
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Library</h1>
        <span className="text-sm text-zinc-500">
          {videos.length} video{videos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {videos.length === 0 ? (
        <div className="mx-auto mt-24 max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold">No videos yet</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Connect a YouTube channel to import your videos and start creating content.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <a
              href={`/api/auth/youtube-connect?redirect=${encodeURIComponent(`/w/${workspaceSlug}/library`)}&workspaceId=${encodeURIComponent(workspace.id)}`}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z" />
                <path fill="white" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
              </svg>
              Connect YouTube Channel
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Channel</th>
                <th className="pb-2 font-medium">Published</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Project</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {videos.map(({ video, channelTitle }) => (
                <VideoRow
                  key={video.id}
                  workspaceId={workspace.id}
                  workspaceSlug={workspaceSlug}
                  video={video}
                  channelTitle={channelTitle}
                  project={projectsByVideo.get(video.id) ?? null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
