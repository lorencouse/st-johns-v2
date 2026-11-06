import { redirect } from "next/navigation";

/**
 * Posts now live on each service's guided path, listed on Services. Old
 * bookmarks and links to the posts list land there instead.
 */
export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  redirect(`/w/${workspaceSlug}/library`);
}
