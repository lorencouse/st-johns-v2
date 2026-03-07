import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  reviewRequests,
  contentProjects,
  users,
} from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const requests = await db
    .select({
      request: reviewRequests,
      projectTitle: contentProjects.title,
      projectId: contentProjects.id,
      requestedByName: users.name,
    })
    .from(reviewRequests)
    .innerJoin(
      contentProjects,
      eq(contentProjects.id, reviewRequests.contentProjectId)
    )
    .leftJoin(users, eq(users.id, reviewRequests.requestedByUserId))
    .where(eq(reviewRequests.workspaceId, workspace.id))
    .orderBy(desc(reviewRequests.requestedAt))
    .limit(50);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Review</h1>

      {requests.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-zinc-500">No items to review.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {requests.map(({ request, projectTitle, projectId, requestedByName }) => (
            <Link
              key={request.id}
              href={`/w/${workspaceSlug}/projects/${projectId}`}
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div>
                <p className="font-medium">{projectTitle}</p>
                <p className="text-sm text-zinc-500">
                  Requested by {requestedByName || "Unknown"}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                {request.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
