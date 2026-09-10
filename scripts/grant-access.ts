/**
 * Add a real (already signed-in) user to a workspace.
 *
 * The import scripts run headlessly and own the workspace as a service
 * identity, so a human needs to be granted membership before the workspace
 * shows up for them in the app. Sign in with Google once first, so that
 * Auth.js has created the user row, then:
 *
 *   bun run scripts/grant-access.ts --email you@example.com
 *
 * Flags:
 *   --email <address>   User to add (required; must have signed in already)
 *   --workspace <slug>  Workspace to add them to (default: st-johns)
 *   --role <role>       owner | admin | editor | reviewer | viewer (default: owner)
 */
import { db } from "@/server/db";
import { users, workspaces, workspaceMembers } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}

const EMAIL = arg("email");
const WORKSPACE_SLUG = arg("workspace", "st-johns")!;
const ROLE = arg("role", "owner") as
  | "owner"
  | "admin"
  | "editor"
  | "reviewer"
  | "viewer";

if (!EMAIL) {
  console.error("Missing --email <address>");
  process.exit(1);
}

async function main() {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, EMAIL!))
    .limit(1);

  if (!user) {
    console.error(
      `No user with email ${EMAIL}.\n` +
        `Sign in to the app with Google as that address first, then re-run this.`
    );
    process.exit(1);
  }

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, WORKSPACE_SLUG))
    .limit(1);

  if (!workspace) {
    console.error(`No workspace "${WORKSPACE_SLUG}".`);
    process.exit(1);
  }

  const [existing] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspace.id),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(workspaceMembers)
      .set({ role: ROLE })
      .where(eq(workspaceMembers.id, existing.id));
    console.log(`Updated ${EMAIL} to ${ROLE} of "${WORKSPACE_SLUG}".`);
  } else {
    await db
      .insert(workspaceMembers)
      .values({ workspaceId: workspace.id, userId: user.id, role: ROLE });
    console.log(`Added ${EMAIL} as ${ROLE} of "${WORKSPACE_SLUG}".`);
  }

  console.log(`Open http://localhost:3000/w/${WORKSPACE_SLUG}/library`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
