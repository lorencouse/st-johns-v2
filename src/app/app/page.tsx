import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function AppPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  // Find user's workspaces
  const memberships = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, session.user.id))
    .limit(1);

  if (memberships.length > 0) {
    redirect(`/w/${memberships[0].workspace.slug}/library`);
  }

  redirect("/app/new-workspace");
}
