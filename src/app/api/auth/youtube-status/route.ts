import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [account] = await db
    .select({
      scope: accounts.scope,
      accessToken: accounts.access_token,
      expiresAt: accounts.expires_at,
    })
    .from(accounts)
    .where(
      and(eq(accounts.userId, session.user.id), eq(accounts.provider, "google"))
    )
    .limit(1);

  if (!account) {
    return NextResponse.json({ connected: false, hasYoutubeScope: false });
  }

  const hasYoutubeScope =
    account.scope?.includes("youtube.force-ssl") ?? false;

  return NextResponse.json({
    connected: true,
    hasYoutubeScope,
  });
}
