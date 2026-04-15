import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { youtubeChannels, workspaceChannels } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { ConnectChannelButton } from "@/components/workspace/connect-channel-button";
import { ReconnectGoogleButton } from "@/components/workspace/reconnect-google-button";
import { RemoveChannelButton } from "@/components/workspace/remove-channel-button";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const channels = await db
    .select({
      id: youtubeChannels.id,
      title: youtubeChannels.title,
      handle: youtubeChannels.handle,
      thumbnailUrl: youtubeChannels.thumbnailUrl,
      syncStatus: workspaceChannels.syncStatus,
      lastSyncedAt: workspaceChannels.lastSyncedAt,
    })
    .from(workspaceChannels)
    .innerJoin(
      youtubeChannels,
      eq(youtubeChannels.id, workspaceChannels.channelId)
    )
    .where(eq(workspaceChannels.workspaceId, workspace.id));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Integrations</h1>

      <div className="mt-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold">Google Account</h2>
          <div className="mt-4 max-w-lg">
            <ReconnectGoogleButton
              redirectPath={`/w/${workspaceSlug}/settings/integrations`}
              workspaceId={workspace.id}
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Connect YouTube Channel</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Connecting a channel imports its videos and playlists into the library.
            Projects and caption fetches still start manually per video.
          </p>
          <div className="mt-4 max-w-md">
            <ConnectChannelButton
              workspaceId={workspace.id}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </section>

        {channels.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">Synced Channels</h2>
            <div className="mt-4 space-y-2">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {channel.thumbnailUrl && (
                      <img
                        src={channel.thumbnailUrl}
                        alt=""
                        className="h-10 w-10 rounded-full"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div>
                      <p className="font-medium">{channel.title}</p>
                      {channel.handle && (
                        <p className="text-sm text-zinc-500">{channel.handle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                        {channel.syncStatus}
                      </span>
                      {channel.lastSyncedAt && (
                        <span className="text-xs text-zinc-400">
                          Last synced{" "}
                          {new Date(channel.lastSyncedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <RemoveChannelButton
                      workspaceId={workspace.id}
                      channelId={channel.id}
                      channelTitle={channel.title}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
