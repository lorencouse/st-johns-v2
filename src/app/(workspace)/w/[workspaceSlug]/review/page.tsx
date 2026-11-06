import { redirect } from "next/navigation";

/**
 * Approvals are shown on Services as the "Waiting for approval" view, so old
 * links to the review queue open that view.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  redirect(`/w/${workspaceSlug}/library?filter=review_queue`);
}
