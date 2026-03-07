import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { sourceVideos, youtubeChannels } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

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
    .limit(50);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Library</h1>
      </div>

      {videos.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-zinc-500">No videos yet.</p>
          <p className="mt-2 text-sm text-zinc-400">
            Connect a YouTube channel in Settings &rarr; Integrations to get
            started.
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
              </tr>
            </thead>
            <tbody>
              {videos.map(({ video, channelTitle }) => (
                <tr
                  key={video.id}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="py-3 pr-4 font-medium">{video.title}</td>
                  <td className="py-3 pr-4 text-zinc-500">{channelTitle}</td>
                  <td className="py-3 pr-4 text-zinc-500">
                    {video.publishedAt
                      ? new Date(video.publishedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="py-3">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                      {video.ingestStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
