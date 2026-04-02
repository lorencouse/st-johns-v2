import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { youtubeChannels, workspaceChannels } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import Image from "next/image";
import { ConnectChannelButton } from "@/components/workspace/connect-channel-button";
import { ReconnectGoogleButton } from "@/components/workspace/reconnect-google-button";

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
          <div className="mt-4 max-w-md">
            <ConnectChannelButton workspaceId={workspace.id} />
          </div>
        </section>

        {channels.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">Synced Channels</h2>
            <div className="mt-4 space-y-2">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    {channel.thumbnailUrl && (
                      <Image
                        src={channel.thumbnailUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-medium">{channel.title}</p>
                      {channel.handle && (
                        <p className="text-sm text-zinc-500">{channel.handle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
