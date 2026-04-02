import { auth } from "@/server/auth";
import { signOut } from "@/server/auth";
import { normalizeEmail } from "@/lib/security";
import { db } from "@/server/db";
import {
  workspaceInvites,
  workspaceMembers,
  workspaces,
} from "@/server/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { createHash } from "crypto";
import { redirect } from "next/navigation";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/invite/${token}`);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [invite] = await db
    .select({
      invite: workspaceInvites,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
    .where(
      and(
        eq(workspaceInvites.tokenHash, tokenHash),
        eq(workspaceInvites.status, "pending"),
        gt(workspaceInvites.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Invalid or expired invite</h1>
          <p className="mt-2 text-zinc-500">
            This invite link is no longer valid.
          </p>
          <a
            href="/app"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Go to App
          </a>
        </div>
      </div>
    );
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, invite.invite.workspaceId),
        eq(workspaceMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (existing) {
    redirect(`/w/${invite.workspaceSlug}/library`);
  }

  const sessionEmail = session.user.email
    ? normalizeEmail(session.user.email)
    : null;
  const invitedEmail = normalizeEmail(invite.invite.email);

  if (!sessionEmail || sessionEmail !== invitedEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-xl font-semibold">Wrong Google account</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            This invite for {invite.workspaceName} was sent to{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {invite.invite.email}
            </span>
            . You are currently signed in as{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {session.user.email ?? "an unknown account"}
            </span>
            .
          </p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Sign out and continue with the invited email address to accept this
            workspace invite.
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({
                redirectTo: `/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`,
              });
            }}
            className="mt-6"
          >
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Sign out and switch account
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Accept the invite
  await db.insert(workspaceMembers).values({
    workspaceId: invite.invite.workspaceId,
    userId: session.user.id,
    role: invite.invite.role,
    createdByUserId: invite.invite.invitedByUserId,
  });

  await db
    .update(workspaceInvites)
    .set({
      status: "accepted",
      acceptedByUserId: session.user.id,
      acceptedAt: new Date(),
    })
    .where(eq(workspaceInvites.id, invite.invite.id));

  redirect(`/w/${invite.workspaceSlug}/library`);
}
