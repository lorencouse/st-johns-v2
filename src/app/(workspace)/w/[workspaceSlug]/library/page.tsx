import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  sourceVideos,
  youtubeChannels,
  contentProjects,
} from "@/server/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { VideoActions } from "@/components/library/video-actions";
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
        <div className="mt-16 text-center">
          <p className="text-zinc-500">No videos yet.</p>
          <p className="mt-2 text-sm text-zinc-400">
            Connect a YouTube channel in{" "}
            <Link
              href={`/w/${workspaceSlug}/settings/integrations`}
              className="underline"
            >
              Settings &rarr; Integrations
            </Link>{" "}
            to get started.
          </p>
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
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map(({ video, channelTitle }) => {
                const project = projectsByVideo.get(video.id);
                return (
                  <tr
                    key={video.id}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {video.thumbnailUrl && (
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="h-9 w-16 rounded object-cover"
                          />
                        )}
                        <span className="font-medium line-clamp-1">
                          {video.title}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-zinc-500">{channelTitle}</td>
                    <td className="py-3 pr-4 text-zinc-500">
                      {video.publishedAt
                        ? new Date(video.publishedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                        {video.ingestStatus.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {project ? (
                        <Link
                          href={`/w/${workspaceSlug}/projects/${project.id}`}
                          className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {project.status.replace("_", " ")}
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <VideoActions
                        workspaceId={workspace.id}
                        videoId={video.id}
                        workspaceSlug={workspaceSlug}
                        ingestStatus={video.ingestStatus}
                        hasProject={!!project}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
