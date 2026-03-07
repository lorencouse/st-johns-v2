import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { integrationConnections, youtubeChannels } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const connections = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.workspaceId, workspace.id));

  const channels = await db
    .select()
    .from(youtubeChannels)
    .where(eq(youtubeChannels.workspaceId, workspace.id));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Integrations</h1>

      <div className="mt-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold">YouTube Connections</h2>
          {connections.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
              <p className="text-zinc-500">No YouTube connections yet.</p>
              <button className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
                Connect YouTube
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div>
                    <p className="font-medium">
                      {conn.externalAccountLabel || "YouTube"}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Status: {conn.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {channels.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">Channels</h2>
            <div className="mt-4 space-y-2">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div>
                    <p className="font-medium">{channel.title}</p>
                    {channel.handle && (
                      <p className="text-sm text-zinc-500">
                        @{channel.handle}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                    {channel.syncStatus}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
