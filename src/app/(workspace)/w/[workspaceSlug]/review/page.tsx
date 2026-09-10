import { requireWorkspaceMember } from "@/lib/workspace";
import { db } from "@/server/db";
import {
  reviewRequests,
  contentProjects,
  users,
} from "@/server/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { Pagination } from "@/components/ui/pagination";
import { parsePage, parsePageSize, resolvePaging } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const { workspace } = await requireWorkspaceMember(workspaceSlug);

  const pageSize = parsePageSize(pageSizeParam);

  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviewRequests)
    .innerJoin(
      contentProjects,
      eq(contentProjects.id, reviewRequests.contentProjectId)
    )
    .where(eq(reviewRequests.workspaceId, workspace.id));
  const total = totals?.total ?? 0;

  const { page, pageCount, offset } = resolvePaging(
    total,
    parsePage(pageParam),
    pageSize
  );

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
    // requestedAt alone is not unique enough to page on: a bulk submit stamps
    // many rows the same second, and ties would shuffle between pages.
    .orderBy(desc(reviewRequests.requestedAt), desc(reviewRequests.id))
    .limit(pageSize)
    .offset(offset);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Review</h1>

      {total === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-zinc-500">No items to review.</p>
        </div>
      ) : (
        <>
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

          <Pagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            total={total}
            label="review request"
          />
        </>
      )}
    </div>
  );
}
