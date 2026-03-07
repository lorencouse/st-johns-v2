import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import { auditEvents, users } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const events = await db
    .select({
      event: auditEvents,
      actorName: users.name,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .where(eq(auditEvents.workspaceId, workspace.id))
    .orderBy(desc(auditEvents.createdAt))
    .limit(100);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>

      {events.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-zinc-500">No audit events yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {events.map(({ event, actorName }) => (
            <div
              key={event.id}
              className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">
                    {actorName || "System"}
                  </span>{" "}
                  {event.summary || event.eventKey}
                </p>
                <p className="text-xs text-zinc-400">
                  {event.createdAt
                    ? new Date(event.createdAt).toLocaleString()
                    : "—"}
                </p>
              </div>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
                {event.eventKey}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
