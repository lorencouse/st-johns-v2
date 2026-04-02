import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { workspaceMembers } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import crypto from "crypto";
import { cookies } from "next/headers";
import { sanitizeLocalRedirectPath } from "@/lib/security";

/**
 * Initiates an incremental OAuth flow to request the youtube.force-ssl scope.
 * This is separate from the initial sign-in which only requests basic profile scopes.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  const redirectParam = sanitizeLocalRedirectPath(
    req.nextUrl.searchParams.get("redirect"),
    "/app"
  );
  const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";

  if (workspaceId) {
    const [membership] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of that workspace" },
        { status: 403 }
      );
    }
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("youtube-oauth-state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  cookieStore.set("youtube-oauth-redirect", redirectParam, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  if (workspaceId) {
    cookieStore.set("youtube-oauth-workspace", workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const callbackUrl = `${baseUrl}/api/auth/youtube-callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope:
      "openid email profile https://www.googleapis.com/auth/youtube.force-ssl",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
